use rig::completion::Usage;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
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
    #[error("Failed to initialize OpenAI client: {0}")]
    Client(String),
    #[error("Rig prompt failed: {0}")]
    Prompt(String),
    #[error("Rig extraction failed: {0}")]
    Extraction(String),
}

impl From<Usage> for RigUsageMetadata {
    fn from(usage: Usage) -> Self {
        Self {
            input_tokens: usage.input_tokens,
            output_tokens: usage.output_tokens,
            total_tokens: usage.total_tokens,
            cached_input_tokens: usage.cached_input_tokens,
            cache_creation_input_tokens: 0,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rig::completion::Usage;

    #[test]
    fn usage_metadata_preserves_every_rig_usage_counter() {
        let usage = Usage {
            input_tokens: 13,
            output_tokens: 8,
            total_tokens: 21,
            cached_input_tokens: 5,
        };

        assert_eq!(
            RigUsageMetadata::from(usage),
            RigUsageMetadata {
                input_tokens: 13,
                output_tokens: 8,
                total_tokens: 21,
                cached_input_tokens: 5,
                cache_creation_input_tokens: 0,
            }
        );
    }

    #[test]
    fn runtime_errors_keep_the_public_operation_prefix() {
        let error = RigRuntimeError::Extraction("provider rejected request".to_string());
        assert_eq!(
            error.to_string(),
            "Rig extraction failed: provider rejected request"
        );
    }
}
