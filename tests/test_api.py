import copy
import importlib
from pathlib import Path
import pytest
from httpx import AsyncClient


@pytest.fixture(scope="module")
def app_module():
    # import the application module (src.app)
    module = importlib.import_module("src.app")
    return module


@pytest.fixture
async def client(app_module):
    async with AsyncClient(app=app_module.app, base_url="http://test") as ac:
        yield ac


@pytest.fixture(autouse=True)
def restore_activities(app_module):
    original = copy.deepcopy(app_module.activities)
    yield
    app_module.activities.clear()
    app_module.activities.update(copy.deepcopy(original))


async def test_get_activities(client):
    r = await client.get("/activities")
    assert r.status_code == 200
    data = r.json()
    # Expect some known activities from the seeded data
    assert "Chess Club" in data


async def test_signup_and_unregister(client, app_module):
    activity = "Chess Club"
    email = "testuser@example.com"

    # Ensure clean start
    if email in app_module.activities[activity]["participants"]:
        app_module.activities[activity]["participants"].remove(email)

    # Sign up
    r = await client.post(f"/activities/{activity}/signup?email={email}")
    assert r.status_code == 200
    assert email in app_module.activities[activity]["participants"]

    # Signing up again should fail
    r2 = await client.post(f"/activities/{activity}/signup?email={email}")
    assert r2.status_code == 400

    # Unregister
    r3 = await client.post(f"/activities/{activity}/unregister?email={email}")
    assert r3.status_code == 200
    assert email not in app_module.activities[activity]["participants"]

    # Unregistering again should fail
    r4 = await client.post(f"/activities/{activity}/unregister?email={email}")
    assert r4.status_code == 400
