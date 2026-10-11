"""Temporary upload leases, separate from any future saved-project storage."""
import math

# Background tabs can throttle timers. A close notification shortens this lease.
LEASE_SECONDS = 30 * 60
CLOSE_GRACE_SECONDS = 15


def expired(project: dict, now: float) -> bool:
    lease = project.get('temporarySession')
    if not isinstance(lease, dict) or not isinstance(lease.get('id'), str):
        return False
    deadline = lease.get('expiresAt')
    return (isinstance(deadline, (int, float)) and not isinstance(deadline, bool)
            and math.isfinite(deadline) and deadline <= now)
