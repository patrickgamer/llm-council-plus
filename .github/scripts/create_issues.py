#!/usr/bin/env python3
"""Creates GitHub issues from issues.md in sequential order.
Uses the gh CLI with GITHUB_TOKEN for authentication.
Issues are created in the order they appear in the file so that
GitHub assigns sequential issue numbers (#1, #2, ..., #16).
"""
import re
import subprocess
import sys


def parse_issues(content: str) -> list:
    """Parse issues.md and return list of issue dicts."""
    issue_pattern = re.compile(r'^## Issue #(\d+): (.+)$', re.MULTILINE)
    matches = list(issue_pattern.finditer(content))

    if not matches:
        raise ValueError("No issues found in issues.md")

    issues = []
    for i, match in enumerate(matches):
        start = match.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(content)
        issue_text = content[start:end]

        lines = issue_text.split('\n')
        title = match.group(2).strip()

        # Parse labels from line like: **Labels:** `setup`, `electron`, `foundation`
        labels = []
        body_start_idx = 1
        for j, line in enumerate(lines[1:], 1):
            label_match = re.match(r'\*\*Labels:\*\* (.+)$', line)
            if label_match:
                label_text = label_match.group(1)
                labels = [
                    l.strip().strip('`').strip()
                    for l in label_text.split(',')
                ]
                labels = [l for l in labels if l]
                body_start_idx = j + 1
                break

        # Skip "Depends on" line and leading empty lines
        while body_start_idx < len(lines):
            line = lines[body_start_idx].strip()
            if line.startswith('**Depends on:**') or not line:
                body_start_idx += 1
            else:
                break

        # Build body text
        body_lines = lines[body_start_idx:]
        body = '\n'.join(body_lines).strip()

        # Remove trailing --- separator (appears between issues in the file)
        body = re.sub(r'\n\s*---\s*$', '', body).strip()

        issues.append({
            'number': int(match.group(1)),
            'title': title,
            'labels': labels,
            'body': body,
        })

    return issues


def create_issue(title: str, body: str, labels: list) -> str:
    """Create a GitHub issue using gh CLI and return its URL."""
    cmd = ['gh', 'issue', 'create', '--title', title, '--body', body]
    for label in labels:
        cmd.extend(['--label', label])

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(
            f"Failed to create issue '{title}':\n"
            f"stdout: {result.stdout}\n"
            f"stderr: {result.stderr}"
        )
    return result.stdout.strip()


def main():
    print("Reading issues.md...")
    try:
        with open('issues.md', 'r') as f:
            content = f.read()
    except FileNotFoundError:
        print("ERROR: issues.md not found in current directory", file=sys.stderr)
        sys.exit(1)

    issues = parse_issues(content)
    print(f"Found {len(issues)} issues to create")

    if len(issues) != 16:
        print(f"WARNING: Expected 16 issues, found {len(issues)}")

    # Verify sequential ordering
    for i, issue in enumerate(issues, 1):
        if issue['number'] != i:
            print(f"WARNING: Expected issue #{i} at position {i}, found #{issue['number']}")

    created = []
    for i, issue in enumerate(issues, 1):
        print(f"\nCreating issue #{i}: {issue['title']}")
        print(f"  Labels: {', '.join(issue['labels'])}")

        try:
            url = create_issue(issue['title'], issue['body'], issue['labels'])
            created.append(url)
            print(f"  Created: {url}")
        except RuntimeError as e:
            print(f"ERROR: {e}", file=sys.stderr)
            print(f"Created {len(created)} issues before failure", file=sys.stderr)
            sys.exit(1)

    print(f"\nSuccessfully created {len(created)} issues:")
    for url in created:
        print(f"  {url}")


if __name__ == '__main__':
    main()
