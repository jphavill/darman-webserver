from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest

from core.errors import NotFoundAppError, ValidationAppError
from models import Photo
from schemas import PhotoUpdateRequest, PhotoUploadRequest
from services.photos import ProcessedPhotoMedia, _parse_exif_datetime, delete_photo, list_photos, update_photo, upload_photo


def _create_photo(
    db_session,
    *,
    alt_text: str,
    caption: str,
    thumb_url: str,
    full_url: str,
    captured_at: datetime,
    is_published: bool,
):
    record = Photo(
        id=uuid4(),
        alt_text=alt_text,
        caption=caption,
        thumb_url=thumb_url,
        full_url=full_url,
        captured_at=captured_at,
        is_published=is_published,
    )
    db_session.add(record)
    db_session.commit()
    db_session.refresh(record)
    return record


def _write_upload_file(tmp_path, *, name: str = "upload.jpg", content: bytes = b"abc"):
    source_path = tmp_path / name
    source_path.write_bytes(content)
    return source_path, len(content)


def _processed_media(*, tmp_path, thumb_url: str = "/media/gallery/new-thumb.webp", full_url: str = "/media/gallery/new-full.webp"):
    return ProcessedPhotoMedia(
        thumb_url=thumb_url,
        full_url=full_url,
        written_paths=(tmp_path / "written-thumb.webp", tmp_path / "written-full.webp"),
    )


def _mock_processed_image(monkeypatch, *, tmp_path, thumb_url: str = "/media/gallery/new-thumb.webp", full_url: str = "/media/gallery/new-full.webp"):
    monkeypatch.setattr(
        "services.photos._process_uploaded_image",
        lambda *, source_path, source_hash: _processed_media(tmp_path=tmp_path, thumb_url=thumb_url, full_url=full_url),
    )


def _upload(
    db_session,
    *,
    filename: str,
    source_path,
    source_hash: str,
    size_bytes: int,
    payload: PhotoUploadRequest,
):
    return upload_photo(
        db=db_session,
        filename=filename,
        source_path=source_path,
        source_hash=source_hash,
        size_bytes=size_bytes,
        payload=payload,
    )


def _set_gallery_media_env(monkeypatch, *, media_root):
    monkeypatch.setenv("MEDIA_ROOT_PATH", str(media_root))
    monkeypatch.setenv("PHOTOS_MEDIA_SUBDIR", "gallery")


def test_list_photos_only_returns_published_sorted(db_session):
    now = datetime.now(timezone.utc)
    _create_photo(
        db_session,
        alt_text="Second",
        caption="Visible second",
        thumb_url="/media/gallery/second-thumb.webp",
        full_url="/media/gallery/second-full.webp",
        captured_at=now - timedelta(days=2),
        is_published=True,
    )
    _create_photo(
        db_session,
        alt_text="First",
        caption="Visible first",
        thumb_url="/media/gallery/first-thumb.webp",
        full_url="/media/gallery/first-full.webp",
        captured_at=now - timedelta(days=1),
        is_published=True,
    )
    _create_photo(
        db_session,
        alt_text="Hidden",
        caption="Not visible",
        thumb_url="/media/gallery/hidden-thumb.webp",
        full_url="/media/gallery/hidden-full.webp",
        captured_at=now,
        is_published=False,
    )

    listed = list_photos(db=db_session, limit=10, offset=0)

    assert listed.total == 2
    assert listed.rows[0].caption == "Visible first"
    assert listed.rows[1].caption == "Visible second"


def test_list_photos_can_include_unpublished_for_admin(db_session):
    now = datetime.now(timezone.utc)
    _create_photo(
        db_session,
        alt_text="Visible",
        caption="Visible",
        thumb_url="/media/gallery/visible-thumb.webp",
        full_url="/media/gallery/visible-full.webp",
        captured_at=now - timedelta(days=1),
        is_published=True,
    )
    _create_photo(
        db_session,
        alt_text="Hidden",
        caption="Hidden",
        thumb_url="/media/gallery/hidden-thumb.webp",
        full_url="/media/gallery/hidden-full.webp",
        captured_at=now,
        is_published=False,
    )

    listed = list_photos(db=db_session, limit=10, offset=0, include_unpublished=True)

    assert listed.total == 2
    assert {row.caption for row in listed.rows} == {"Visible", "Hidden"}


def test_update_photo_updates_existing_record(db_session):
    original_capture = datetime.now(timezone.utc) - timedelta(days=3)
    updated_capture = datetime.now(timezone.utc)
    photo = _create_photo(
        db_session,
        alt_text="Old alt",
        caption="Old caption",
        thumb_url="/media/gallery/old-thumb.webp",
        full_url="/media/gallery/old-full.webp",
        captured_at=original_capture,
        is_published=True,
    )

    updated = update_photo(
        db=db_session,
        photo_id=photo.id,
        payload=PhotoUpdateRequest(
            alt_text="New alt",
            caption="New caption",
            thumb_url="/media/gallery/new-thumb.webp",
            full_url="/media/gallery/new-full.webp",
            captured_at=updated_capture,
            is_published=False,
        ),
    )

    assert updated.id == photo.id
    assert updated.alt_text == "New alt"
    assert updated.caption == "New caption"
    assert updated.thumb_url == "/media/gallery/new-thumb.webp"
    assert updated.full_url == "/media/gallery/new-full.webp"
    assert updated.captured_at == updated_capture
    assert updated.is_published is False


def test_update_photo_supports_partial_updates(db_session):
    captured_at = datetime.now(timezone.utc) - timedelta(days=3)
    photo = _create_photo(
        db_session,
        alt_text="Original alt",
        caption="Original caption",
        thumb_url="/media/gallery/original-thumb.webp",
        full_url="/media/gallery/original-full.webp",
        captured_at=captured_at,
        is_published=True,
    )

    updated = update_photo(
        db=db_session,
        photo_id=photo.id,
        payload=PhotoUpdateRequest(caption="Updated caption only", is_published=False),
    )

    assert updated.id == photo.id
    assert updated.alt_text == "Original alt"
    assert updated.caption == "Updated caption only"
    assert updated.thumb_url == "/media/gallery/original-thumb.webp"
    assert updated.full_url == "/media/gallery/original-full.webp"
    assert updated.captured_at == captured_at
    assert updated.is_published is False


def test_delete_photo_removes_record(db_session):
    photo = _create_photo(
        db_session,
        alt_text="Delete me",
        caption="Will be deleted",
        thumb_url="/media/gallery/delete-thumb.webp",
        full_url="/media/gallery/delete-full.webp",
        captured_at=datetime.now(timezone.utc),
        is_published=True,
    )

    delete_photo(db=db_session, photo_id=photo.id)
    listed = list_photos(db=db_session, limit=10, offset=0)
    assert listed.total == 0


def test_update_and_delete_photo_raise_404_for_missing_id(db_session):
    missing_id = uuid4()

    with pytest.raises(NotFoundAppError) as update_exc:
        update_photo(
            db=db_session,
            photo_id=missing_id,
            payload=PhotoUpdateRequest(
                alt_text="Missing",
                caption="Missing",
                thumb_url="/media/gallery/missing-thumb.webp",
                full_url="/media/gallery/missing-full.webp",
                captured_at=datetime.now(timezone.utc),
                is_published=True,
            ),
        )

    with pytest.raises(NotFoundAppError) as delete_exc:
        delete_photo(db=db_session, photo_id=missing_id)

    assert update_exc.value.status_code == 404
    assert delete_exc.value.status_code == 404


def test_upload_photo_uses_caption_as_alt_text_when_alt_blank(db_session, monkeypatch, tmp_path):
    source_path, size_bytes = _write_upload_file(tmp_path)
    _mock_processed_image(monkeypatch, tmp_path=tmp_path)
    monkeypatch.setattr(
        "services.photos._extract_exif_captured_at",
        lambda source_path: datetime(2026, 4, 1, 8, 30, tzinfo=timezone.utc),
    )

    uploaded = _upload(
        db_session,
        filename="upload.jpg",
        source_path=source_path,
        source_hash="hash-1",
        size_bytes=size_bytes,
        payload=PhotoUploadRequest(caption="  Golden hour  ", alt_text="   ", is_published=True),
    )

    assert uploaded.alt_text == "Golden hour"
    assert uploaded.caption == "Golden hour"
    assert uploaded.captured_at == datetime(2026, 4, 1, 8, 30, tzinfo=timezone.utc)


def test_upload_photo_manual_capture_override_beats_exif(db_session, monkeypatch, tmp_path):
    source_path, size_bytes = _write_upload_file(tmp_path)
    _mock_processed_image(monkeypatch, tmp_path=tmp_path)
    monkeypatch.setattr(
        "services.photos._extract_exif_captured_at",
        lambda source_path: datetime(2025, 1, 1, 0, 0, tzinfo=timezone.utc),
    )
    override = datetime(2026, 4, 5, 17, 45, tzinfo=timezone.utc)

    uploaded = _upload(
        db_session,
        filename="upload.jpg",
        source_path=source_path,
        source_hash="hash-2",
        size_bytes=size_bytes,
        payload=PhotoUploadRequest(caption="Ridgeline", captured_at=override, is_published=False),
    )

    assert uploaded.captured_at == override
    assert uploaded.is_published is False


def test_upload_photo_falls_back_to_client_last_modified_when_exif_missing(db_session, monkeypatch, tmp_path):
    source_path, size_bytes = _write_upload_file(tmp_path)
    _mock_processed_image(monkeypatch, tmp_path=tmp_path)
    monkeypatch.setattr("services.photos._extract_exif_captured_at", lambda source_path: None)

    client_last_modified = datetime(2026, 3, 19, 19, 16, 45, tzinfo=timezone(timedelta(hours=-7)))
    uploaded = _upload(
        db_session,
        filename="upload.jpg",
        source_path=source_path,
        source_hash="hash-3",
        size_bytes=size_bytes,
        payload=PhotoUploadRequest(
            caption="Client date fallback",
            client_last_modified=client_last_modified,
            is_published=True,
        ),
    )

    assert uploaded.captured_at == client_last_modified.astimezone(timezone.utc)


def test_parse_exif_datetime_without_timezone_defaults_to_utc():
    parsed = _parse_exif_datetime(value="2026:03:19 19:16:45")

    assert parsed == datetime(2026, 3, 19, 19, 16, 45, tzinfo=timezone.utc)


def test_parse_exif_datetime_with_offset_tag_parses_create_date_value():
    parsed = _parse_exif_datetime(value="2026:03:19 19:16:45", offset_value="-07:00")

    assert parsed == datetime(2026, 3, 20, 2, 16, 45, tzinfo=timezone.utc)


def test_upload_photo_rejects_unsupported_extension(db_session, tmp_path):
    source_path, size_bytes = _write_upload_file(tmp_path, name="upload.gif")
    with pytest.raises(ValidationAppError) as exc:
        _upload(
            db_session,
            filename="upload.gif",
            source_path=source_path,
            source_hash="hash-4",
            size_bytes=size_bytes,
            payload=PhotoUploadRequest(caption="Bad ext"),
        )

    assert str(exc.value) == "Unsupported image format"


def test_upload_photo_rejects_blank_caption_and_alt_text(db_session, tmp_path):
    source_path, size_bytes = _write_upload_file(tmp_path)
    with pytest.raises(ValidationAppError) as exc:
        _upload(
            db_session,
            filename="upload.jpg",
            source_path=source_path,
            source_hash="hash-blank",
            size_bytes=size_bytes,
            payload=PhotoUploadRequest(caption="   ", alt_text="   "),
        )

    assert str(exc.value) == "alt_text or caption must be provided"


def test_upload_photo_rolls_back_and_cleans_written_files_on_commit_error(db_session, monkeypatch, tmp_path):
    source_path, size_bytes = _write_upload_file(tmp_path)
    written_thumb = tmp_path / "thumb.webp"
    written_full = tmp_path / "full.webp"
    written_thumb.write_bytes(b"thumb")
    written_full.write_bytes(b"full")

    monkeypatch.setattr(
        "services.photos._process_uploaded_image",
        lambda *, source_path, source_hash: ProcessedPhotoMedia(
            thumb_url="/media/gallery/new-thumb.webp",
            full_url="/media/gallery/new-full.webp",
            written_paths=(written_thumb, written_full),
        ),
    )
    monkeypatch.setattr("services.photos._extract_exif_captured_at", lambda source_path: None)

    rollback_calls = {"count": 0}

    def _raise_commit_failure():
        raise RuntimeError("commit failed")

    def _mark_rollback():
        rollback_calls["count"] += 1

    monkeypatch.setattr(db_session, "commit", _raise_commit_failure)
    monkeypatch.setattr(db_session, "rollback", _mark_rollback)

    with pytest.raises(RuntimeError):
        _upload(
            db_session,
            filename="upload.jpg",
            source_path=source_path,
            source_hash="hash-rollback",
            size_bytes=size_bytes,
            payload=PhotoUploadRequest(caption="Commit failure"),
        )

    assert rollback_calls["count"] == 1
    assert not written_thumb.exists()
    assert not written_full.exists()


def test_upload_photo_processes_real_image_and_persists_webp_outputs(db_session, monkeypatch, tmp_path):
    pil = pytest.importorskip("PIL.Image")

    media_root = tmp_path / "media"
    monkeypatch.setenv("MEDIA_ROOT_PATH", str(media_root))
    monkeypatch.setenv("PHOTOS_MEDIA_SUBDIR", "gallery")
    monkeypatch.setenv("PHOTOS_MAX_IMAGE_PIXELS", "1000000")
    monkeypatch.setattr("services.photos._extract_exif_captured_at", lambda source_path: None)

    source_path = tmp_path / "upload.png"
    image = pil.new("RGB", (40, 20), color=(12, 34, 56))
    image.save(source_path, format="PNG")

    uploaded = _upload(
        db_session,
        filename="upload.png",
        source_path=source_path,
        source_hash="image-hash",
        size_bytes=len(source_path.read_bytes()),
        payload=PhotoUploadRequest(caption="Real decode path"),
    )

    assert uploaded.thumb_url == "/media/gallery/image-hash-thumb.webp"
    assert uploaded.full_url == "/media/gallery/image-hash-full.webp"
    assert (media_root / "gallery" / "image-hash-thumb.webp").exists()
    assert (media_root / "gallery" / "image-hash-full.webp").exists()


def test_delete_photo_removes_unreferenced_files(db_session, monkeypatch, tmp_path):
    media_root = tmp_path / "media"
    gallery_dir = media_root / "gallery"
    gallery_dir.mkdir(parents=True)
    _set_gallery_media_env(monkeypatch, media_root=media_root)

    thumb_url = "/media/gallery/unique-thumb.webp"
    full_url = "/media/gallery/unique-full.webp"
    (gallery_dir / "unique-thumb.webp").write_bytes(b"thumb")
    (gallery_dir / "unique-full.webp").write_bytes(b"full")

    created = _create_photo(
        db_session,
        alt_text="Cleanup",
        caption="Cleanup",
        thumb_url=thumb_url,
        full_url=full_url,
        captured_at=datetime.now(timezone.utc),
        is_published=True,
    )

    delete_photo(db=db_session, photo_id=created.id)

    assert not (gallery_dir / "unique-thumb.webp").exists()
    assert not (gallery_dir / "unique-full.webp").exists()


def test_delete_photo_keeps_files_when_still_referenced(db_session, monkeypatch, tmp_path):
    media_root = tmp_path / "media"
    gallery_dir = media_root / "gallery"
    gallery_dir.mkdir(parents=True)
    _set_gallery_media_env(monkeypatch, media_root=media_root)

    shared_thumb = "/media/gallery/shared-thumb.webp"
    shared_full = "/media/gallery/shared-full.webp"
    (gallery_dir / "shared-thumb.webp").write_bytes(b"thumb")
    (gallery_dir / "shared-full.webp").write_bytes(b"full")

    first = _create_photo(
        db_session,
        alt_text="One",
        caption="One",
        thumb_url=shared_thumb,
        full_url=shared_full,
        captured_at=datetime.now(timezone.utc),
        is_published=True,
    )
    second = _create_photo(
        db_session,
        alt_text="Two",
        caption="Two",
        thumb_url=shared_thumb,
        full_url=shared_full,
        captured_at=datetime.now(timezone.utc),
        is_published=True,
    )

    delete_photo(db=db_session, photo_id=first.id)

    assert (gallery_dir / "shared-thumb.webp").exists()
    assert (gallery_dir / "shared-full.webp").exists()

    delete_photo(db=db_session, photo_id=second.id)

    assert not (gallery_dir / "shared-thumb.webp").exists()
    assert not (gallery_dir / "shared-full.webp").exists()


def test_delete_photo_does_not_delete_paths_outside_gallery_root(db_session, monkeypatch, tmp_path):
    media_root = tmp_path / "media"
    gallery_dir = media_root / "gallery"
    outside_dir = tmp_path / "outside"
    gallery_dir.mkdir(parents=True)
    outside_dir.mkdir(parents=True)
    _set_gallery_media_env(monkeypatch, media_root=media_root)

    outside_file = outside_dir / "escape.webp"
    outside_file.write_bytes(b"outside")
    valid_file = gallery_dir / "safe-full.webp"
    valid_file.write_bytes(b"safe")

    created = _create_photo(
        db_session,
        alt_text="Path check",
        caption="Path check",
        thumb_url="/media/gallery/../outside/escape.webp",
        full_url="/media/gallery/safe-full.webp",
        captured_at=datetime.now(timezone.utc),
        is_published=True,
    )

    delete_photo(db=db_session, photo_id=created.id)

    assert outside_file.exists()
    assert not valid_file.exists()
