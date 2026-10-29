#!/bin/sh
set -eu

# A regex proxy_pass must contain an origin, without a path or credentials.
# Reject whitespace and nginx syntax before the official envsubst step.
validate_origin() {
    if ! printf '%s\n' "$2" | LC_ALL=C awk -v BINMODE=3 '
        NR != 1 || $0 !~ /^http:\/\/([A-Za-z0-9][A-Za-z0-9.-]*|\[[0-9A-Fa-f:]+\])(:[0-9]+)?$/ { invalid = 1 }
        END { exit invalid }
    '; then
        printf 'Invalid %s: expected a private HTTP origin with no path or credentials.\n' "$1" >&2
        exit 1
    fi
}

validate_origin HOW_BASE_UPSTREAM "$HOW_BASE_UPSTREAM"
validate_origin HOW_ARTICLE_UPSTREAM "$HOW_ARTICLE_UPSTREAM"
validate_origin HOW_USER_UPSTREAM "$HOW_USER_UPSTREAM"
