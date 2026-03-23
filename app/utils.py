# app/utils.py

BASE62_ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
BASE = len(BASE62_ALPHABET)

def encode_base62(num: int) -> str:
    """
    Converts a positive integer into a Base62 string.
    Used to generate short, URL-safe codes from database IDs.
    """
    if num == 0:
        return BASE62_ALPHABET[0]

    chars = []

    while num > 0:
        remainder = num % BASE
        chars.append(BASE62_ALPHABET[remainder])
        num //= BASE

    return ''.join(reversed(chars))

