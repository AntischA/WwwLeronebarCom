# glavni_direktorij/api/slike_kafica.py
from __future__ import annotations

import os
import random
from typing import Iterable, List, Optional

from flask import jsonify, url_for, make_response, current_app

DEFAULT_EXTS = {'.jpg', '.jpeg', '.png', '.webp', '.gif'}


def _safe_listdir(path: str) -> Iterable[str]:
    for name in os.listdir(path):
        if not name.startswith('.'):
            yield name


def _filter_images(files: Iterable[str], exts: Iterable[str]) -> List[str]:
    exts_lower = {e.lower() for e in exts}
    return [f for f in files if os.path.splitext(f)[1].lower() in exts_lower]


def _sort_or_shuffle_files(folder: str, files: List[str], sort: str, reverse: bool, seed: Optional[int]) -> List[str]:
    s = (sort or 'mtime').lower()
    if s == 'name':
        files.sort(reverse=reverse)
    elif s == 'random':
        rng = random.Random(seed) if seed is not None else random
        rng.shuffle(files)
    else:
        # podrazumevano po mtime
        files.sort(key=lambda f: os.path.getmtime(os.path.join(folder, f)), reverse=reverse)
    return files


def _files_to_urls(files: List[str]) -> List[str]:
    return [url_for('static', filename=f'slike_kafica/{f}', _external=False) for f in files]


def list_slike_kafica(
    exts: Iterable[str] = DEFAULT_EXTS,
    sort: str = 'random',
    order: str = 'asc',
    limit: Optional[int] = None,
    seed: Optional[int] = None,
) -> List[str]:
    """
    Vraća listu URL-ova slika iz /static/slike_kafica.
    - sort: 'random' | 'mtime' | 'name'  (default: 'random')
    - order: 'asc' | 'desc'              (ignoriše se za 'random')
    - seed: int ili None                 (ako je zadat, random postaje deterministički)
    - limit: maks. broj rezultata
    """
    folder = os.path.join(current_app.static_folder, 'slike_kafica')
    if not os.path.isdir(folder):
        return []

    files = _filter_images(_safe_listdir(folder), exts)
    reverse = (order or 'asc').lower() == 'desc'
    files = _sort_or_shuffle_files(folder, files, sort=sort, reverse=reverse, seed=seed)

    if limit is not None and limit > 0:
        files = files[:limit]

    return _files_to_urls(files)


def get_slike_kafica_response(
    sort: str = 'random',
    order: str = 'asc',
    limit: Optional[int] = None,
    seed: Optional[int] = None,
    cache_max_age: int = 300
):
    """
    HTTP odgovor (JSON lista URL-ova) sa odgovarajućim Cache-Control.
    - Ako je sort='random' i seed nije zadan → 'no-store' (svaki refresh novi poredak).
    - Inače → 'public, max-age=cache_max_age'.
    """
    try:
        urls = list_slike_kafica(sort=sort, order=order, limit=limit, seed=seed)
        resp = make_response(jsonify(urls))

        if (sort or '').lower() == 'random' and seed is None:
            # bez keširanja – da bi se svaki put promiješale
            resp.headers['Cache-Control'] = 'no-store'
        else:
            resp.headers['Cache-Control'] = f'public, max-age={cache_max_age}'

        return resp
    except Exception:
        resp = make_response(jsonify({
            "error": "cannot_list_images",
            "message": "Došlo je do greške prilikom listanja slika."
        }), 500)
        resp.headers['Cache-Control'] = 'no-store'
        return resp
