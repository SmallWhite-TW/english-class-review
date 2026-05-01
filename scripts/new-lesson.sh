#!/usr/bin/env bash
# Scaffold a new lesson directory under english-courses/.
#
# Usage:
#   scripts/new-lesson.sh <lesson-number>
#
# Examples:
#   scripts/new-lesson.sh 8        # creates lesson-008
#   scripts/new-lesson.sh 008      # also creates lesson-008
#
# Layout produced:
#   english-courses/lesson-NNN/
#     ├── pre-study/    # put pre-class md files here
#     └── records/      # put post-class review md files here
#     (materials/ created on demand only — NOT for the repo)
#
# This is the canonical structure expected by scripts/migrate-lessons.ts.

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <lesson-number>"
  echo "Example: $0 8"
  exit 1
fi

# Strip non-digits, pad to 3 digits
RAW="$1"
NUM="${RAW//[!0-9]/}"
if [ -z "$NUM" ]; then
  echo "Error: '$RAW' contains no digits" >&2
  exit 1
fi
PADDED=$(printf "%03d" "$((10#$NUM))")
LESSON_ID="lesson-${PADDED}"

# Source root: defaults to the canonical local path; override via $ECR_SOURCE_ROOT.
SOURCE_ROOT="${ECR_SOURCE_ROOT:-/opt/white/project/english_class/english-courses}"
LESSON_DIR="${SOURCE_ROOT}/${LESSON_ID}"

if [ -e "$LESSON_DIR" ]; then
  echo "Already exists: $LESSON_DIR"
  echo "Existing layout:"
  ls -la "$LESSON_DIR"
  exit 0
fi

mkdir -p "$LESSON_DIR/pre-study" "$LESSON_DIR/records"

echo "✓ Created $LESSON_DIR"
echo
echo "Layout:"
ls -la "$LESSON_DIR"
echo
echo "Next steps:"
echo "  1. Put pre-class study notes in:    $LESSON_DIR/pre-study/"
echo "  2. Put post-class review md in:     $LESSON_DIR/records/"
echo "     (filename pattern e.g. YYMMDD-${LESSON_ID}-review.md)"
echo "  3. From the repo:  npm run migrate:lessons"
