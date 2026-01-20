# AnnotateGPT: Designing Human-AI Collaboration in Pen-Based Document Annotation

[DOI](https://doi.org/10.1145/3772318.3790867) 

## Project Summary
<p align="justify">
Providing high-quality feedback on writing is cognitively demanding, requiring reviewers to identify issues, suggest fixes, and ensure consistency. We introduce <i>AnnotateGPT</i>, a system that uses pen-based annotations as an input modality for AI agents to assist with essay feedback. AnnotateGPT enhances feedback by interpreting handwritten annotations and extending them throughout the document. One AI agent classifies the <i>purpose</i> of each annotation, which is confirmed or corrected by the user. A second AI agent uses the confirmed purpose to generate contextually relevant feedback for other parts of the essay. In a study with 12 novice teachers annotating essays, we compared <i>AnnotateGPT</i> with a baseline pen-based tool without AI support. Our findings demonstrate how reviewers used annotations to regulate AI feedback generation, refine AI suggestions, and incorporate AI-generated feedback into their review process. We highlight design implications for AI-augmented feedback systems, including balanced human-AI collaboration and using pen annotations as subtle interaction.
</p>

## Getting Started

### OpenAI Prerequisites

In `.env`, please provide the following information from OpenAI API:
- `NEXT_PUBLIC_OPEN_AI_KEY`: OpenAI [API key](https://platform.openai.com/api-keys)
- `NEXT_PUBLIC_ANNOTATE_VECTOR_STORE`: [Vector store](https://platform.openai.com/storage/vector_stores) ID to store the document

Optional:
- `NEXT_PUBLIC_PURPOSE_VECTOR_STORE`: [Vector store](https://platform.openai.com/storage/vector_stores) ID to store annotation history
- `NEXT_PUBLIC_DOCUMENT_ONE_ID`: First [document](https://platform.openai.com/storage/files) ID for study
- `NEXT_PUBLIC_DOCUMENT_TWO_ID`: Second [document](https://platform.openai.com/storage/files) ID for study
- `NEXT_PUBLIC_PRACTICE_DOCUMENT_ID`: Practice [document](https://platform.openai.com/storage/files) ID for study

### Prerequisites
- Install [Node.js](https://nodejs.org/en/download/)
- Next, install all dependencies
```
npm install
```
- Supported browsers:
    - Google Chrome
    - Opera
    - Microsoft Edge

### How to run

#### Local
To run locally
```
npm run build
npm start
```
Or in development
```
npm run dev
```
