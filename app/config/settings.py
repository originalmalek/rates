from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    mongodb_url: str = "mongodb://localhost:27017"
    mongodb_db: str = "rates"
    cors_origins: list[str] = ["http://localhost:3000"]
    redis_url: str = "redis://localhost:6379/0"
    # How often the worker fetches DeFi Llama. Default: once a day (1440 min).
    collect_interval_minutes: int = 1440
    # A series whose newest snapshot is older than this is treated as stale
    # and hidden from /latest — DeFi Llama stopped returning it, so its last
    # value would otherwise linger on the dashboard forever. None → derive
    # from the collect interval (see ``effective_max_age_minutes``).
    latest_max_age_minutes: int | None = None

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def effective_max_age_minutes(self) -> int:
        """Staleness cutoff for /latest, in minutes.

        An explicit ``latest_max_age_minutes`` wins; otherwise tolerate ~2.5
        collection cycles so a single late or failed worker run doesn't blank
        rows, while a genuinely dropped series disappears soon after.
        """
        if self.latest_max_age_minutes is not None:
            return self.latest_max_age_minutes
        return int(self.collect_interval_minutes * 2.5)


settings = Settings()
