from io import BytesIO


def test_projects_list_only_returns_published_to_public(client, monkeypatch, admin_auth_headers):
    monkeypatch.setenv("ADMIN_API_TOKEN", "secret")
    headers = admin_auth_headers("secret")

    draft = client.post(
        "/v1/projects",
        headers=headers,
        json={
            "title": "Draft",
            "short_description": "Draft short",
            "long_description_md": "Draft long",
            "type": "software",
            "is_published": False,
            "links": [],
        },
    )
    assert draft.status_code == 200

    live = client.post(
        "/v1/projects",
        headers=headers,
        json={
            "title": "Live",
            "short_description": "Live short",
            "long_description_md": "Live long",
            "type": "software",
            "is_published": True,
            "links": [],
        },
    )
    assert live.status_code == 200

    public_response = client.get("/v1/projects?type=software")
    assert public_response.status_code == 200
    assert public_response.json()["total"] == 1

    client.cookies.clear()
    unauthorized = client.get("/v1/projects?include_unpublished=true")
    assert unauthorized.status_code == 401

    admin_auth_headers("secret")
    admin_response = client.get("/v1/projects?include_unpublished=true&type=software")
    assert admin_response.status_code == 200
    assert admin_response.json()["total"] == 2


def test_project_mutations_require_auth(client, monkeypatch):
    monkeypatch.setenv("ADMIN_API_TOKEN", "secret")

    create = client.post(
        "/v1/projects",
        json={
            "title": "Draft",
            "short_description": "Draft short",
            "long_description_md": "Draft long",
            "type": "software",
            "is_published": False,
            "links": [],
        },
    )
    assert create.status_code == 401


def test_project_reorder_and_publish_toggle(client, monkeypatch, admin_auth_headers):
    monkeypatch.setenv("ADMIN_API_TOKEN", "secret")
    headers = admin_auth_headers("secret")

    first = client.post(
        "/v1/projects",
        headers=headers,
        json={
            "title": "One",
            "short_description": "Short",
            "long_description_md": "Long",
            "type": "physical",
            "is_published": True,
            "links": [],
        },
    )
    second = client.post(
        "/v1/projects",
        headers=headers,
        json={
            "title": "Two",
            "short_description": "Short",
            "long_description_md": "Long",
            "type": "physical",
            "is_published": True,
            "links": [],
        },
    )
    assert first.status_code == 200
    assert second.status_code == 200

    first_id = first.json()["id"]
    second_id = second.json()["id"]

    updated = client.patch(f"/v1/projects/{first_id}", headers=headers, json={"is_published": False})
    assert updated.status_code == 200
    assert updated.json()["is_published"] is False

    third = client.post(
        "/v1/projects",
        headers=headers,
        json={
            "title": "Three",
            "short_description": "Short",
            "long_description_md": "Long",
            "type": "physical",
            "is_published": True,
            "links": [],
        },
    )
    assert third.status_code == 200
    third_id = third.json()["id"]

    partial_reorder = client.post(
        "/v1/projects/reorder",
        headers=headers,
        json={"type": "physical", "project_ids": [second_id, first_id]},
    )
    assert partial_reorder.status_code == 422

    duplicate_reorder = client.post(
        "/v1/projects/reorder",
        headers=headers,
        json={"type": "physical", "project_ids": [first_id, first_id, third_id]},
    )
    assert duplicate_reorder.status_code == 422

    reordered = client.post(
        "/v1/projects/reorder",
        headers=headers,
        json={"type": "physical", "project_ids": [second_id, first_id, third_id]},
    )
    assert reordered.status_code == 200
    assert [row["id"] for row in reordered.json()["rows"]] == [second_id, first_id, third_id]


def test_project_image_upload_reorder_and_delete(client, monkeypatch, admin_auth_headers):
    monkeypatch.setenv("ADMIN_API_TOKEN", "secret")
    headers = admin_auth_headers("secret")

    monkeypatch.setattr(
        "services.projects._process_uploaded_image",
        lambda *, content: {"thumb_url": "/media/projects/t.webp", "full_url": "/media/projects/f.webp"},
    )

    created = client.post(
        "/v1/projects",
        headers=headers,
        json={
            "title": "With images",
            "short_description": "Short",
            "long_description_md": "Long",
            "type": "software",
            "is_published": True,
            "links": [],
        },
    )
    assert created.status_code == 200
    project_id = created.json()["id"]

    upload_one = client.post(
        f"/v1/projects/{project_id}/images",
        headers=headers,
        files={"file": ("one.jpg", BytesIO(b"x"), "image/jpeg")},
        data={"alt_text": "One", "caption": "First", "is_hero": "true"},
    )
    assert upload_one.status_code == 200

    upload_two = client.post(
        f"/v1/projects/{project_id}/images",
        headers=headers,
        files={"file": ("two.jpg", BytesIO(b"y"), "image/jpeg")},
        data={"alt_text": "Two", "caption": "Second", "is_hero": "false"},
    )
    assert upload_two.status_code == 200

    image_one_id = upload_one.json()["id"]
    image_two_id = upload_two.json()["id"]

    reorder = client.patch(
        f"/v1/projects/{project_id}/images/reorder",
        headers=headers,
        json={"image_ids": [image_two_id, image_one_id]},
    )
    assert reorder.status_code == 200
    assert [row["id"] for row in reorder.json()] == [image_two_id, image_one_id]

    hero_toggle = client.patch(
        f"/v1/projects/{project_id}/images/{image_two_id}",
        headers=headers,
        json={"is_hero": True},
    )
    assert hero_toggle.status_code == 200
    assert hero_toggle.json()["is_hero"] is True

    metadata_update = client.patch(
        f"/v1/projects/{project_id}/images/{image_two_id}",
        headers=headers,
        json={"alt_text": "   ", "caption": "Updated caption"},
    )
    assert metadata_update.status_code == 200
    assert metadata_update.json()["alt_text"] == "Updated caption"
    assert metadata_update.json()["caption"] == "Updated caption"

    metadata_update_blank = client.patch(
        f"/v1/projects/{project_id}/images/{image_two_id}",
        headers=headers,
        json={"alt_text": "   ", "caption": "   "},
    )
    assert metadata_update_blank.status_code == 200
    assert metadata_update_blank.json()["alt_text"] == "Updated caption"
    assert metadata_update_blank.json()["caption"] is None

    delete = client.delete(f"/v1/projects/{project_id}/images/{image_one_id}", headers=headers)
    assert delete.status_code == 204


def test_project_image_upload_rejects_files_over_size_limit(client, monkeypatch, admin_auth_headers):
    monkeypatch.setenv("ADMIN_API_TOKEN", "secret")
    monkeypatch.setenv("PROJECTS_MAX_UPLOAD_BYTES", "4")
    headers = admin_auth_headers("secret")

    created = client.post(
        "/v1/projects",
        headers=headers,
        json={
            "title": "With images",
            "short_description": "Short",
            "long_description_md": "Long",
            "type": "software",
            "is_published": True,
            "links": [],
        },
    )
    assert created.status_code == 200
    project_id = created.json()["id"]

    oversized = client.post(
        f"/v1/projects/{project_id}/images",
        headers=headers,
        files={"file": ("large.jpg", BytesIO(b"12345"), "image/jpeg")},
        data={"alt_text": "Large", "caption": "", "is_hero": "false"},
    )
    assert oversized.status_code == 422
    assert oversized.json()["detail"] == "Uploaded image exceeds configured max size (4 bytes)"


def test_project_image_reorder_errors_are_specific(client, monkeypatch, admin_auth_headers):
    monkeypatch.setenv("ADMIN_API_TOKEN", "secret")
    headers = admin_auth_headers("secret")

    created = client.post(
        "/v1/projects",
        headers=headers,
        json={
            "title": "No images",
            "short_description": "Short",
            "long_description_md": "Long",
            "type": "software",
            "is_published": True,
            "links": [],
        },
    )
    assert created.status_code == 200
    project_id = created.json()["id"]

    empty_project_reorder = client.patch(
        f"/v1/projects/{project_id}/images/reorder",
        headers=headers,
        json={"image_ids": ["0adf8e88-c44f-47f5-85dd-0914adf5ccb8"]},
    )
    assert empty_project_reorder.status_code == 422
    assert empty_project_reorder.json()["detail"] == "Project has no images to reorder"

    missing_project_reorder = client.patch(
        "/v1/projects/7d6ae3f6-63d9-4980-a999-bc707ecfd670/images/reorder",
        headers=headers,
        json={"image_ids": ["0adf8e88-c44f-47f5-85dd-0914adf5ccb8"]},
    )
    assert missing_project_reorder.status_code == 404
    assert missing_project_reorder.json()["detail"] == "Project not found"
