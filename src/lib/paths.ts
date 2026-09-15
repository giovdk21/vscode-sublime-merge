'use strict';
import * as path from 'path';

/**
 * Converts a path to use forward slashes.
 *
 * Git (and Sublime Merge's search/blame queries) expect forward slashes, but
 * `path.relative` yields backslashes on Windows. Using a regex keeps this
 * deterministic regardless of the host platform's `path.sep`.
 */
export function toForwardSlashes(p: string): string {
	return p.replace(/\\/g, '/');
}

/**
 * Repo-relative path computed from two URI paths.
 *
 * URI `.path` values always use forward slashes and share the same base
 * (container or host), so `path.posix.relative` yields the correct segment on
 * every platform, including Windows drive paths like `/d:/repo/file.ts`.
 */
export function relativeUriPath(repoUriPath: string, fileUriPath: string): string {
	return path.posix.relative(repoUriPath, fileUriPath);
}

/**
 * Repo-relative path computed from two local filesystem paths, normalised to
 * forward slashes for Git / Sublime Merge.
 */
export function relativeLocalPath(repoRoot: string, localFilePath: string): string {
	return toForwardSlashes(path.relative(repoRoot, localFilePath));
}
