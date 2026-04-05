"""Sweetbook Book Print API integration"""

import os
import sys
from pathlib import Path

# Add SDK to path
SDK_PATH = os.getenv("BOOKPRINT_SDK_PATH", str(Path(__file__).parent.parent.parent.parent / "bookprintapi-python-sdk"))
if SDK_PATH not in sys.path:
    sys.path.insert(0, SDK_PATH)

from bookprintapi import Client, ApiError


def get_client() -> Client:
    return Client()


def create_book(title: str) -> str:
    """Create a draft book and return its UID."""
    client = get_client()
    result = client.books.create(
        book_spec_uid="SQUAREBOOK_HC",
        title=title,
        creation_type="TEST",
    )
    return result["data"]["bookUid"]


def upload_photo(book_uid: str, file_path: str) -> dict:
    """Upload a photo to a book."""
    client = get_client()
    return client.photos.upload(book_uid, file_path)


def create_cover(book_uid: str, template_uid: str, parameters: dict, files: list[str] | None = None) -> dict:
    """Create book cover with template."""
    client = get_client()
    return client.covers.create(book_uid, template_uid=template_uid, parameters=parameters, files=files)


def insert_content(book_uid: str, template_uid: str, parameters: dict, files: list[str] | None = None) -> dict:
    """Insert a content page."""
    client = get_client()
    return client.contents.insert(book_uid, template_uid=template_uid, parameters=parameters, files=files, break_before="page")


def finalize_book(book_uid: str) -> dict:
    """Finalize the book (no more edits)."""
    client = get_client()
    return client.books.finalize(book_uid)


def estimate_order(book_uid: str, quantity: int = 1) -> dict:
    """Get price estimate."""
    client = get_client()
    return client.orders.estimate([{"bookUid": book_uid, "quantity": quantity}])


def create_order(book_uid: str, shipping: dict, quantity: int = 1) -> dict:
    """Create an order (deducts credits)."""
    client = get_client()
    return client.orders.create(
        items=[{"bookUid": book_uid, "quantity": quantity}],
        shipping=shipping,
    )


def get_order(order_uid: str) -> dict:
    """Get order details."""
    client = get_client()
    return client.orders.get(order_uid)


def get_balance() -> float:
    """Get current credit balance."""
    client = get_client()
    result = client.credits.get_balance()
    return result["data"]["balance"]
