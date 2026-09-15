import * as assert from 'assert';
import * as path from 'path';

import { relativeLocalPath, relativeUriPath, toForwardSlashes } from '../lib/paths';

suite('paths', () => {
	suite('toForwardSlashes', () => {
		test('converts Windows backslashes to forward slashes', () => {
			assert.strictEqual(toForwardSlashes('src\\lib\\paths.ts'), 'src/lib/paths.ts');
		});

		test('leaves forward-slash paths unchanged', () => {
			assert.strictEqual(toForwardSlashes('src/lib/paths.ts'), 'src/lib/paths.ts');
		});

		test('handles mixed separators', () => {
			assert.strictEqual(toForwardSlashes('src\\lib/paths.ts'), 'src/lib/paths.ts');
		});

		test('returns an empty string unchanged', () => {
			assert.strictEqual(toForwardSlashes(''), '');
		});
	});

	suite('relativeUriPath', () => {
		test('computes a POSIX relative path', () => {
			assert.strictEqual(
				relativeUriPath('/home/user/repo', '/home/user/repo/src/commands.ts'),
				'src/commands.ts'
			);
		});

		// Regression: on Windows the file URI path is like /d:/repo/... and the
		// result must use forward slashes (issue #44).
		test('returns forward slashes for a Windows drive URI path', () => {
			assert.strictEqual(
				relativeUriPath('/d:/GitHub/vscode-sublime-merge', '/d:/GitHub/vscode-sublime-merge/src/commands.ts'),
				'src/commands.ts'
			);
		});

		test('handles nested subdirectories', () => {
			assert.strictEqual(
				relativeUriPath('/d:/repo', '/d:/repo/a/b/c/file.ts'),
				'a/b/c/file.ts'
			);
		});

		test('returns empty string when file is the repo root', () => {
			assert.strictEqual(relativeUriPath('/d:/repo', '/d:/repo'), '');
		});
	});

	suite('relativeLocalPath', () => {
		test('computes a relative path on the current platform', () => {
			const repoRoot = path.join('some', 'repo');
			const file = path.join('some', 'repo', 'src', 'commands.ts');
			assert.strictEqual(relativeLocalPath(repoRoot, file), 'src/commands.ts');
		});

		test('always yields forward slashes regardless of platform separator', () => {
			const result = relativeLocalPath(
				path.join('repo', 'root'),
				path.join('repo', 'root', 'a', 'b', 'c.ts')
			);
			assert.strictEqual(result, 'a/b/c.ts');
			assert.ok(!result.includes('\\'), 'result must not contain backslashes');
		});
	});
});
