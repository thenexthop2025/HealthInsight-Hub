from __future__ import annotations

from typing import Callable, Dict, List

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from models import Analysis


SectionHandler = Callable[['Analysis', Dict, Dict], List]


_HANDLERS: Dict[str, SectionHandler] = {}


def register_handler(analysis_type: str):
    def decorator(func: SectionHandler) -> SectionHandler:
        _HANDLERS[analysis_type] = func
        return func

    return decorator


def get_handler(analysis_type: str) -> SectionHandler | None:
    return _HANDLERS.get(analysis_type)


# Import handlers to populate the registry
from . import descriptive  # noqa: E402,F401
from . import frequency  # noqa: E402,F401
from . import crosstab  # noqa: E402,F401
from . import correlation  # noqa: E402,F401
from . import regression  # noqa: E402,F401
from . import chi_square  # noqa: E402,F401
from . import stratified  # noqa: E402,F401
from . import mendelian  # noqa: E402,F401
