"""
Synthetic data loader toolkit for Tartware environments.

Provides shared utilities (`db_config`, `data_store`, `load_all`) plus category-specific
packages underneath `scripts.data.*`. Each subpackage mirrors a business domain
so documentation stays discoverable and focused.
"""

from importlib import import_module


# Surface commonly referenced helper modules to make documentation easier to browse.
__all__ = [
    "db_config",
    "data_store",
    "list_empty_tables",
    "load_all",
    "split_loaders",
]


def __getattr__(name: str):
    """Lazy-import well-known helper modules on attribute access."""
    if name in __all__:
        return import_module(f"{__name__}.{name}")
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
