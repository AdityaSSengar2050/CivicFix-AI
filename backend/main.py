import os
from pathlib import Path
from typing import Literal

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import types
from pydantic import BaseModel, field_validator

# Load environment variables from backend/.env
ENV_PATH = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=ENV_PATH)

app = FastAPI(title="CivicFix AI Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

issues: list[dict] = []
issue_id_counter = 1


class IssueCreate(BaseModel):
    title: str
    description: str
    location: str

    @field_validator("title", "description", "location")
    @classmethod
    def validate_non_whitespace(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("Must not be empty or contain only whitespace")
        return trimmed


class TriageResponse(BaseModel):
    category: Literal["road damage", "sanitation", "water", "streetlight", "safety", "other"]
    urgency: Literal["low", "medium", "high"]
    summary: str
    suggested_action: str


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.post("/issues", status_code=status.HTTP_201_CREATED)
def create_issue(issue: IssueCreate):
    global issue_id_counter
    new_issue = {
        "id": issue_id_counter,
        "title": issue.title,
        "description": issue.description,
        "location": issue.location,
    }
    issue_id_counter += 1
    issues.append(new_issue)
    return new_issue


@app.post("/triage", response_model=TriageResponse)
def triage_issue(issue: IssueCreate):
    # Reload environment to pick up any changes to backend/.env
    load_dotenv(dotenv_path=ENV_PATH, override=True)
    api_key = os.getenv("GEMINI_API_KEY")

    if not api_key or not api_key.strip() or api_key == "your_key_here":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI triage service is unavailable: GEMINI_API_KEY is missing or unconfigured.",
        )

    prompt = (
        "You are a civic issue triage assistant. Analyze and classify the following reported civic issue:\n\n"
        f"Title: {issue.title}\n"
        f"Description: {issue.description}\n"
        f"Location: {issue.location}\n\n"
        "Provide:\n"
        "- category: one of 'road damage', 'sanitation', 'water', 'streetlight', 'safety', 'other'\n"
        "- urgency: one of 'low', 'medium', 'high'\n"
        "- summary: a clear and concise summary of the problem\n"
        "- suggested_action: recommended immediate action for municipal authorities or dispatch team"
    )

    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model="gemini-3.8-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=TriageResponse,
            ),
        )

        if not response.text:
            raise ValueError("Empty response received from AI model")

        return TriageResponse.model_validate_json(response.text)
    except HTTPException:
        raise
    except Exception:
        # Never log or expose api_key or internal secrets
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI triage analysis failed. Please verify your API key and try again.",
        )
