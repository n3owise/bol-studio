#!/usr/bin/env python3
"""Give the projects in a data directory an owner.

Turning accounts on makes an unowned project belong to nobody — see owns() in
server/app.py. Every project created before accounts existed has no owner field,
so this is how you claim a data directory you actually own.

It is a script rather than something the server does at startup on purpose.
There is no way to tell whose those projects were, so any automatic rule would
be a guess, and the obvious guess — the first account to sign in gets them —
hands one person everyone else's work on a shared deployment.

    python scripts/backfill-owner.py --owner <supabase-user-id> --dry-run
    python scripts/backfill-owner.py --owner <supabase-user-id>

The user id is the `sub` claim in your access token, which is also the id shown
on the user's row in the Supabase dashboard.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--owner", required=True, help="the Supabase user id to assign")
    parser.add_argument("--data-dir", default="data", type=Path)
    parser.add_argument("--dry-run", action="store_true", help="say what would change and stop")
    parser.add_argument("--force", action="store_true",
                        help="also reassign projects that already have a different owner")
    args = parser.parse_args()

    if not args.data_dir.is_dir():
        print(f"No such data directory: {args.data_dir}", file=sys.stderr)
        return 1

    claimed = skipped = 0
    for path in sorted(args.data_dir.glob("*/project.json")):
        try:
            project = json.loads(path.read_text())
        except (OSError, ValueError) as error:
            print(f"  skipping {path.parent.name}: {error}", file=sys.stderr)
            continue
        existing = (project.get("owner") or "").strip()
        if existing and existing != args.owner and not args.force:
            print(f"  leaving  {path.parent.name} — already owned by {existing[:12]}…")
            skipped += 1
            continue
        if existing == args.owner:
            continue
        print(f"  claiming {path.parent.name} — {project.get('name', 'untitled')}")
        claimed += 1
        if args.dry_run:
            continue
        project["owner"] = args.owner
        # Written whole and moved into place, so an interrupted run cannot leave
        # a half-written project.json behind — the same bargain write_project
        # makes in the server.
        temporary = path.with_suffix(".tmp")
        temporary.write_text(json.dumps(project, ensure_ascii=False))
        temporary.replace(path)

    verb = "would be claimed" if args.dry_run else "claimed"
    print(f"\n{claimed} {verb}" + (f", {skipped} left alone (use --force to take them too)" if skipped else ""))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
