class AppError(Exception):
    status_code = 500
    detail = "Internal server error"

    def __init__(self, detail: str | None = None):
        super().__init__(detail or self.detail)
        self.detail = detail or self.detail


class ValidationAppError(AppError):
    status_code = 422
    detail = "Validation failed"


class NotFoundAppError(AppError):
    status_code = 404
    detail = "Resource not found"


class UnauthorizedAppError(AppError):
    status_code = 401
    detail = "Unauthorized"


class ForbiddenAppError(AppError):
    status_code = 403
    detail = "Forbidden"


class ServiceUnavailableAppError(AppError):
    status_code = 503
    detail = "Service unavailable"
