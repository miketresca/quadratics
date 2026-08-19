from __future__ import annotations

from dataclasses import dataclass

from app.schemas.artifact import ArtifactStage
from app.services.artifacts.hashing import artifact_input_hash
from app.services.artifacts.repository import ArtifactRecord, InMemoryArtifactRepository


@dataclass(frozen=True)
class StageRun:
    artifact: ArtifactRecord
    cache_hit: bool


class ArtifactLifecycleService:
    def __init__(self, repository: InMemoryArtifactRepository) -> None:
        self._repository = repository

    def start_stage(
        self,
        *,
        generation_job_id: str,
        user_id: str,
        stage: ArtifactStage,
        input_payload: dict[str, object],
        upstream_artifact_ids: list[str] | None = None,
        provider: str | None = None,
        model: str | None = None,
        config_metadata: dict[str, object] | None = None,
        force: bool = False,
    ) -> StageRun:
        input_hash = artifact_input_hash(
            {
                "input": input_payload,
                "upstreamArtifactIds": upstream_artifact_ids or [],
                "provider": provider,
                "model": model,
                "config": config_metadata or {},
            }
        )
        if not force:
            reusable = self._repository.find_reusable(
                generation_job_id=generation_job_id,
                stage=stage,
                input_hash=input_hash,
            )
            if reusable is not None:
                return StageRun(artifact=reusable, cache_hit=True)

        artifact = self._repository.create_attempt(
            generation_job_id=generation_job_id,
            user_id=user_id,
            stage=stage,
            input_hash=input_hash,
            upstream_artifact_ids=upstream_artifact_ids,
            provider=provider,
            model=model,
            config_metadata=config_metadata,
        )
        return StageRun(artifact=artifact, cache_hit=False)
