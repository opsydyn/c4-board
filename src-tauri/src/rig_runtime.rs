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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn zero_usage_remains_a_valid_provider_metadata_value() {
        assert_eq!(
            RigUsageMetadata::default(),
            RigUsageMetadata {
                input_tokens: 0,
                output_tokens: 0,
                total_tokens: 0,
                cached_input_tokens: 0,
                cache_creation_input_tokens: 0,
            }
        );
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
