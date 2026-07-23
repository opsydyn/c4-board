use rig_core::{
    client::CompletionClient,
    completion::{Prompt, Usage},
    providers::openai,
};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RigUsageMetadata {
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub total_tokens: u64,
    pub cached_input_tokens: u64,
    pub cache_creation_input_tokens: u64,
}

impl From<Usage> for RigUsageMetadata {
    fn from(usage: Usage) -> Self {
        Self {
            input_tokens: usage.input_tokens,
            output_tokens: usage.output_tokens,
            total_tokens: usage.total_tokens,
            cached_input_tokens: usage.cached_input_tokens,
            cache_creation_input_tokens: usage.cache_creation_input_tokens,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RigPromptOutput {
    pub message: String,
    pub usage: RigUsageMetadata,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RigExtractionOutput<T> {
    pub data: T,
    pub usage: RigUsageMetadata,
}

#[derive(Debug, thiserror::Error)]
pub enum RigRuntimeError {
    #[error("Failed to initialize OpenAI client: provider client initialization failed")]
    Client,
    #[error("Rig prompt failed: provider request failed")]
    Prompt,
    #[error("Rig extraction failed: provider request failed")]
    Extraction,
}

pub async fn prompt_openai(
    api_key: &str,
    model: &str,
    preamble: &str,
    temperature: f64,
    max_tokens: u64,
    prompt: &str,
) -> Result<RigPromptOutput, RigRuntimeError> {
    let client: openai::Client = openai::Client::builder()
        .api_key(api_key)
        .build()
        .map_err(|_| RigRuntimeError::Client)?;
    let agent = client
        .agent(model)
        .preamble(preamble)
        .temperature(temperature)
        .max_tokens(max_tokens)
        .build();
    let response = agent
        .prompt(prompt)
        .extended_details()
        .await
        .map_err(|_| RigRuntimeError::Prompt)?;

    Ok(RigPromptOutput {
        message: response.output().to_string(),
        usage: response.usage().into(),
    })
}

pub async fn extract_openai<T>(
    api_key: &str,
    model: &str,
    preamble: &str,
    max_tokens: u64,
    context: Option<&str>,
    retries: u64,
    prompt: &str,
) -> Result<RigExtractionOutput<T>, RigRuntimeError>
where
    T: JsonSchema + for<'de> Deserialize<'de> + Serialize + Send + Sync + 'static,
{
    let client: openai::Client = openai::Client::builder()
        .api_key(api_key)
        .build()
        .map_err(|_| RigRuntimeError::Client)?;
    let mut extractor = client
        .extractor::<T>(model)
        .preamble(preamble)
        .max_tokens(max_tokens)
        .retries(retries);

    if let Some(context) = context {
        extractor = extractor.context(context);
    }

    let response = extractor
        .build()
        .extract_with_usage(prompt)
        .await
        .map_err(|_| RigRuntimeError::Extraction)?;

    Ok(RigExtractionOutput {
        data: response.data,
        usage: response.usage.into(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn zero_usage_remains_a_valid_provider_metadata_value() {
        assert_eq!(
            RigUsageMetadata::from(Usage::new()),
            RigUsageMetadata::default()
        );
    }

    #[test]
    fn usage_metadata_serializes_with_camel_case_fields() {
        let json = serde_json::to_value(RigUsageMetadata {
            input_tokens: 1,
            output_tokens: 2,
            total_tokens: 3,
            cached_input_tokens: 4,
            cache_creation_input_tokens: 5,
        })
        .expect("usage should serialize");

        assert_eq!(json["inputTokens"], 1);
        assert_eq!(json["cacheCreationInputTokens"], 5);
    }

    #[test]
    fn runtime_errors_do_not_expose_secret_like_provider_details() {
        let provider_detail = "authorization failed for sk-proj-rig-runtime-secret";
        let display = RigRuntimeError::Extraction.to_string();

        assert_eq!(display, "Rig extraction failed: provider request failed");
        assert!(!display.contains(provider_detail));
    }

    #[test]
    fn runtime_errors_keep_operation_specific_public_prefixes() {
        assert!(RigRuntimeError::Client
            .to_string()
            .starts_with("Failed to initialize OpenAI client:"));
        assert!(RigRuntimeError::Prompt
            .to_string()
            .starts_with("Rig prompt failed:"));
        assert!(RigRuntimeError::Extraction
            .to_string()
            .starts_with("Rig extraction failed:"));
    }
}
