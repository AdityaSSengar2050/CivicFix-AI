import pytest
from fastapi.testclient import TestClient
from main import app, issues


@pytest.fixture(autouse=True)
def clean_issues():
    """Ensure in-memory issues list is clean for isolated test runs."""
    issues.clear()
    yield
    issues.clear()


@pytest.fixture
def client():
    """Test client fixture for making requests to FastAPI app."""
    return TestClient(app)


def test_health_check(client):
    """Test GET /health returns 200 and expected status."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_get_issues_empty(client):
    """Test GET /issues returns empty list initially."""
    response = client.get("/issues")
    assert response.status_code == 200
    assert response.json() == []


def test_create_issue_success(client):
    """Test successful issue creation via POST /issues."""
    payload = {
        "title": "Broken Streetlight",
        "description": "Streetlight is flickering and dark at night",
        "location": "Oak St and 5th Ave",
    }
    response = client.post("/issues", json=payload)
    assert response.status_code == 201

    data = response.json()
    assert "id" in data
    assert data["title"] == payload["title"]
    assert data["description"] == payload["description"]
    assert data["location"] == payload["location"]


@pytest.mark.parametrize(
    "invalid_payload",
    [
        {"title": "   ", "description": "Valid desc", "location": "Valid loc"},
        {"title": "Valid", "description": "   ", "location": "Valid loc"},
        {"title": "Valid", "description": "Valid desc", "location": "   "},
        {"title": "", "description": "", "location": ""},
    ],
)
def test_create_issue_whitespace_validation(client, invalid_payload):
    """Test that empty or whitespace-only fields are rejected with HTTP 422."""
    response = client.post("/issues", json=invalid_payload)
    assert response.status_code == 422


def test_issues_retrieval_after_creation(client):
    """Test that created issues are properly returned by GET /issues."""
    client.post(
        "/issues",
        json={"title": "Pothole", "description": "Large hole", "location": "Main St"},
    )
    client.post(
        "/issues",
        json={"title": "Water leak", "description": "Pipe burst", "location": "Water St"},
    )

    response = client.get("/issues")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["title"] == "Pothole"
    assert data[1]["title"] == "Water leak"


def test_triage_missing_key_returns_503(client, monkeypatch):
    """Test POST /triage gracefully returns HTTP 503 if GEMINI_API_KEY is not configured."""
    monkeypatch.setenv("GEMINI_API_KEY", "")
    response = client.post(
        "/triage",
        json={
            "title": "Fallen tree branch",
            "description": "Branch blocking road",
            "location": "Elm Street",
        },
    )
    assert response.status_code == 503
    assert "unavailable" in response.json()["detail"].lower()
