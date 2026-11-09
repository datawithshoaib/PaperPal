from pydantic import BaseModel, Field


class PaperAnalysis(BaseModel):
    """Structured analysis of a paper. Also used as the LLM's structured-output schema."""

    tldr: str = Field(description="One sentence that captures the paper's core idea.")
    summary: str = Field(description="A 3-5 sentence summary of the paper.")
    problem_statement: str = Field(description="The problem the paper addresses and why it matters.")
    contributions: list[str] = Field(description="The paper's main contributions, one per item.")
    methodology: str = Field(description="How the approach works, in a short paragraph.")
    experiments: str = Field(description="Datasets, baselines, and the experimental setup.")
    key_findings: list[str] = Field(description="The most important reported results, one per item.")
    limitations: list[str] = Field(
        description="Limitations stated by the authors or clearly implied by the evidence, one per item."
    )
    keywords: list[str] = Field(description="Between 3 and 8 short topical keywords.")
