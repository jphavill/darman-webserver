from uuid import uuid4

import pytest

from core.errors import NotFoundAppError, ValidationAppError
from schemas import (
    ProjectCreateRequest,
    ProjectImageReorderRequest,
    ProjectImageUpdateRequest,
    ProjectImageUploadRequest,
    ProjectUpdateRequest,
)
from services.projects import (
    create_project,
    delete_project_image,
    list_projects,
    reorder_project_images,
    reorder_projects,
    update_project,
    update_project_image,
    upload_project_image,
)


def test_create_and_list_projects(db_session):
    create_project(
        db=db_session,
        payload=ProjectCreateRequest(
            title="Draft",
            short_description="Draft short",
            long_description_md="Draft long",
            type="software",
            is_published=False,
            links=[],
        ),
    )
    create_project(
        db=db_session,
        payload=ProjectCreateRequest(
            title="Live",
            short_description="Live short",
            long_description_md="Live long",
            type="software",
            is_published=True,
            links=[],
        ),
    )

    public_list = list_projects(db=db_session, project_type="software", include_unpublished=False)
    admin_list = list_projects(db=db_session, project_type="software", include_unpublished=True)

    assert public_list.total == 1
    assert public_list.rows[0].title == "Live"
    assert admin_list.total == 2


def test_update_and_reorder_projects(db_session):
    first = create_project(
        db=db_session,
        payload=ProjectCreateRequest(
            title="First",
            short_description="Short",
            long_description_md="Long",
            type="physical",
            is_published=True,
            links=[],
        ),
    )
    second = create_project(
        db=db_session,
        payload=ProjectCreateRequest(
            title="Second",
            short_description="Short",
            long_description_md="Long",
            type="physical",
            is_published=True,
            links=[],
        ),
    )

    updated = update_project(
        db=db_session,
        project_id=first.id,
        payload=ProjectUpdateRequest(title="First Updated", is_published=False),
    )
    assert updated.title == "First Updated"
    assert updated.is_published is False

    reordered = reorder_projects(
        db=db_session,
        project_type="physical",
        project_ids=[second.id, first.id],
    )
    assert [row.id for row in reordered.rows] == [second.id, first.id]


def test_update_project_type_appends_to_end_of_destination_section(db_session):
    physical = create_project(
        db=db_session,
        payload=ProjectCreateRequest(
            title="Physical",
            short_description="Short",
            long_description_md="Long",
            type="physical",
            is_published=True,
            links=[],
        ),
    )
    _software_first = create_project(
        db=db_session,
        payload=ProjectCreateRequest(
            title="Software One",
            short_description="Short",
            long_description_md="Long",
            type="software",
            is_published=True,
            links=[],
        ),
    )
    software_second = create_project(
        db=db_session,
        payload=ProjectCreateRequest(
            title="Software Two",
            short_description="Short",
            long_description_md="Long",
            type="software",
            is_published=True,
            links=[],
        ),
    )

    moved = update_project(
        db=db_session,
        project_id=software_second.id,
        payload=ProjectUpdateRequest(type="physical"),
    )

    assert moved.type == "physical"
    assert moved.sort_order == 1

    physical_rows = list_projects(db=db_session, project_type="physical", include_unpublished=True).rows
    assert [row.id for row in physical_rows] == [physical.id, software_second.id]


def test_image_lifecycle_with_hero_toggle_and_reorder(db_session, monkeypatch):
    project = create_project(
        db=db_session,
        payload=ProjectCreateRequest(
            title="Image Project",
            short_description="Short",
            long_description_md="Long",
            type="software",
            is_published=True,
            links=[],
        ),
    )

    image_counter = {"value": 0}

    def fake_process(*, content: bytes):
        image_counter["value"] += 1
        index = image_counter["value"]
        return {
            "thumb_url": f"/media/projects/thumb-{index}.webp",
            "full_url": f"/media/projects/full-{index}.webp",
        }

    monkeypatch.setattr("services.projects._process_uploaded_image", fake_process)

    first = upload_project_image(
        db=db_session,
        project_id=project.id,
        filename="one.jpg",
        content=b"1",
        payload=ProjectImageUploadRequest(alt_text="One", caption="First", is_hero=True),
    )
    second = upload_project_image(
        db=db_session,
        project_id=project.id,
        filename="two.jpg",
        content=b"2",
        payload=ProjectImageUploadRequest(alt_text="Two", caption="Second", is_hero=False),
    )

    assert first.is_hero is True

    updated_second = update_project_image(
        db=db_session,
        project_id=project.id,
        image_id=second.id,
        payload=ProjectImageUpdateRequest(is_hero=True),
    )
    assert updated_second.is_hero is True

    reordered = reorder_project_images(
        db=db_session,
        project_id=project.id,
        payload=ProjectImageReorderRequest(image_ids=[second.id, first.id]),
    )
    assert [row.id for row in reordered] == [second.id, first.id]

    delete_project_image(db=db_session, project_id=project.id, image_id=first.id)

    refreshed = list_projects(db=db_session, project_type="software", include_unpublished=True)
    assert len(refreshed.rows[0].images) == 1


def test_update_project_image_uses_caption_when_alt_text_is_whitespace(db_session, monkeypatch):
    project = create_project(
        db=db_session,
        payload=ProjectCreateRequest(
            title="Image metadata",
            short_description="Short",
            long_description_md="Long",
            type="software",
            is_published=True,
            links=[],
        ),
    )

    monkeypatch.setattr(
        "services.projects._process_uploaded_image",
        lambda *, content: {"thumb_url": "/media/projects/t.webp", "full_url": "/media/projects/f.webp"},
    )

    image = upload_project_image(
        db=db_session,
        project_id=project.id,
        filename="one.jpg",
        content=b"1",
        payload=ProjectImageUploadRequest(alt_text="Original alt", caption="Original caption", is_hero=False),
    )

    updated = update_project_image(
        db=db_session,
        project_id=project.id,
        image_id=image.id,
        payload=ProjectImageUpdateRequest(alt_text="   ", caption="Updated caption"),
    )

    assert updated.caption == "Updated caption"
    assert updated.alt_text == "Updated caption"


def test_update_project_image_keeps_existing_alt_when_alt_and_caption_are_whitespace(db_session, monkeypatch):
    project = create_project(
        db=db_session,
        payload=ProjectCreateRequest(
            title="Image metadata",
            short_description="Short",
            long_description_md="Long",
            type="software",
            is_published=True,
            links=[],
        ),
    )

    monkeypatch.setattr(
        "services.projects._process_uploaded_image",
        lambda *, content: {"thumb_url": "/media/projects/t.webp", "full_url": "/media/projects/f.webp"},
    )

    image = upload_project_image(
        db=db_session,
        project_id=project.id,
        filename="one.jpg",
        content=b"1",
        payload=ProjectImageUploadRequest(alt_text="Original alt", caption="Original caption", is_hero=False),
    )

    updated = update_project_image(
        db=db_session,
        project_id=project.id,
        image_id=image.id,
        payload=ProjectImageUpdateRequest(alt_text="   ", caption="   "),
    )

    assert updated.caption is None
    assert updated.alt_text == "Original alt"


def test_upload_image_rejects_more_than_12(db_session, monkeypatch):
    project = create_project(
        db=db_session,
        payload=ProjectCreateRequest(
            title="Image Cap",
            short_description="Short",
            long_description_md="Long",
            type="software",
            is_published=True,
            links=[],
        ),
    )

    monkeypatch.setattr(
        "services.projects._process_uploaded_image",
        lambda *, content: {"thumb_url": "/media/projects/t.webp", "full_url": "/media/projects/f.webp"},
    )

    for index in range(12):
        upload_project_image(
            db=db_session,
            project_id=project.id,
            filename=f"{index}.jpg",
            content=b"x",
            payload=ProjectImageUploadRequest(alt_text=f"Image {index}", caption=None, is_hero=False),
        )

    with pytest.raises(ValidationAppError):
        upload_project_image(
            db=db_session,
            project_id=project.id,
            filename="overflow.jpg",
            content=b"x",
            payload=ProjectImageUploadRequest(alt_text="Overflow", caption=None, is_hero=False),
        )


def test_upload_image_rejects_content_over_configured_max_bytes(db_session, monkeypatch):
    monkeypatch.setenv("PROJECTS_MAX_UPLOAD_BYTES", "3")
    project = create_project(
        db=db_session,
        payload=ProjectCreateRequest(
            title="Too Large",
            short_description="Short",
            long_description_md="Long",
            type="software",
            is_published=True,
            links=[],
        ),
    )

    with pytest.raises(ValidationAppError) as exc:
        upload_project_image(
            db=db_session,
            project_id=project.id,
            filename="large.jpg",
            content=b"1234",
            payload=ProjectImageUploadRequest(alt_text="Large", caption=None, is_hero=False),
        )

    assert str(exc.value) == "Uploaded image exceeds configured max size (3 bytes)"


def test_delete_project_image_removes_unreferenced_files(db_session, monkeypatch, tmp_path):
    media_root = tmp_path / "media"
    projects_dir = media_root / "projects"
    projects_dir.mkdir(parents=True)
    monkeypatch.setenv("MEDIA_ROOT_PATH", str(media_root))
    monkeypatch.setenv("PROJECTS_MEDIA_SUBDIR", "projects")

    thumb_url = "/media/projects/unique-thumb.webp"
    full_url = "/media/projects/unique-full.webp"
    (projects_dir / "unique-thumb.webp").write_bytes(b"thumb")
    (projects_dir / "unique-full.webp").write_bytes(b"full")

    project = create_project(
        db=db_session,
        payload=ProjectCreateRequest(
            title="Cleanup",
            short_description="Short",
            long_description_md="Long",
            type="software",
            is_published=True,
            links=[],
        ),
    )

    monkeypatch.setattr(
        "services.projects._process_uploaded_image",
        lambda *, content: {"thumb_url": thumb_url, "full_url": full_url},
    )
    image = upload_project_image(
        db=db_session,
        project_id=project.id,
        filename="cleanup.jpg",
        content=b"x",
        payload=ProjectImageUploadRequest(alt_text="Cleanup", caption=None, is_hero=False),
    )

    delete_project_image(db=db_session, project_id=project.id, image_id=image.id)

    assert not (projects_dir / "unique-thumb.webp").exists()
    assert not (projects_dir / "unique-full.webp").exists()


def test_delete_project_image_keeps_files_when_still_referenced(db_session, monkeypatch, tmp_path):
    media_root = tmp_path / "media"
    projects_dir = media_root / "projects"
    projects_dir.mkdir(parents=True)
    monkeypatch.setenv("MEDIA_ROOT_PATH", str(media_root))
    monkeypatch.setenv("PROJECTS_MEDIA_SUBDIR", "projects")

    shared_thumb = "/media/projects/shared-thumb.webp"
    shared_full = "/media/projects/shared-full.webp"
    (projects_dir / "shared-thumb.webp").write_bytes(b"thumb")
    (projects_dir / "shared-full.webp").write_bytes(b"full")

    project = create_project(
        db=db_session,
        payload=ProjectCreateRequest(
            title="Shared",
            short_description="Short",
            long_description_md="Long",
            type="software",
            is_published=True,
            links=[],
        ),
    )

    monkeypatch.setattr(
        "services.projects._process_uploaded_image",
        lambda *, content: {"thumb_url": shared_thumb, "full_url": shared_full},
    )
    first = upload_project_image(
        db=db_session,
        project_id=project.id,
        filename="one.jpg",
        content=b"1",
        payload=ProjectImageUploadRequest(alt_text="One", caption=None, is_hero=False),
    )
    upload_project_image(
        db=db_session,
        project_id=project.id,
        filename="two.jpg",
        content=b"2",
        payload=ProjectImageUploadRequest(alt_text="Two", caption=None, is_hero=False),
    )

    delete_project_image(db=db_session, project_id=project.id, image_id=first.id)

    assert (projects_dir / "shared-thumb.webp").exists()
    assert (projects_dir / "shared-full.webp").exists()


def test_missing_project_errors(db_session):
    with pytest.raises(NotFoundAppError):
        update_project(db=db_session, project_id=uuid4(), payload=ProjectUpdateRequest(title="x"))

    with pytest.raises(NotFoundAppError):
        delete_project_image(db=db_session, project_id=uuid4(), image_id=uuid4())

    with pytest.raises(ValidationAppError):
        reorder_projects(
            db=db_session,
            project_type="software",
            project_ids=[uuid4()],
        )


def test_reorder_project_images_errors_are_specific(db_session):
    with pytest.raises(NotFoundAppError):
        reorder_project_images(
            db=db_session,
            project_id=uuid4(),
            payload=ProjectImageReorderRequest(image_ids=[uuid4()]),
        )

    project = create_project(
        db=db_session,
        payload=ProjectCreateRequest(
            title="No Images",
            short_description="Short",
            long_description_md="Long",
            type="software",
            is_published=True,
            links=[],
        ),
    )

    with pytest.raises(ValidationAppError):
        reorder_project_images(
            db=db_session,
            project_id=project.id,
            payload=ProjectImageReorderRequest(image_ids=[uuid4()]),
        )


def test_reorder_projects_requires_exact_section_membership(db_session):
    one = create_project(
        db=db_session,
        payload=ProjectCreateRequest(
            title="One",
            short_description="Short",
            long_description_md="Long",
            type="software",
            is_published=True,
            links=[],
        ),
    )
    two = create_project(
        db=db_session,
        payload=ProjectCreateRequest(
            title="Two",
            short_description="Short",
            long_description_md="Long",
            type="software",
            is_published=True,
            links=[],
        ),
    )
    three = create_project(
        db=db_session,
        payload=ProjectCreateRequest(
            title="Three",
            short_description="Short",
            long_description_md="Long",
            type="software",
            is_published=True,
            links=[],
        ),
    )

    with pytest.raises(ValidationAppError):
        reorder_projects(
            db=db_session,
            project_type="software",
            project_ids=[one.id, two.id],
        )

    with pytest.raises(ValidationAppError):
        reorder_projects(
            db=db_session,
            project_type="software",
            project_ids=[one.id, one.id, three.id],
        )

    reordered = reorder_projects(
        db=db_session,
        project_type="software",
        project_ids=[three.id, one.id, two.id],
    )
    assert [row.id for row in reordered.rows] == [three.id, one.id, two.id]
