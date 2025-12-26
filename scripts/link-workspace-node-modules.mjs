#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(repoRoot, "..");
const rootNodeModules = path.join(rootDir, "node_modules");

const workspacesToVisit = [
	path.join(rootDir, "Apps"),
	path.join(rootDir, "schema"),
];

const symlinkType = process.platform === "win32" ? "junction" : "dir";

const ensureSymlink = async (workspaceDir) => {
	const linkPath = path.join(workspaceDir, "node_modules");
	try {
		const stats = await fs.lstat(linkPath);
		if (stats.isSymbolicLink()) {
			return;
		}
		// Respect fully installed workspace-level node_modules directories.
		return;
	} catch (error) {
		if ((error ?? {}).code !== "ENOENT") {
			throw error;
		}
	}

	const relativeTarget = path.relative(workspaceDir, rootNodeModules) || ".";
	await fs.symlink(relativeTarget, linkPath, symlinkType);
};

const findWorkspaceDirs = async () => {
	const workspaceDirs = [];
	for (const candidate of workspacesToVisit) {
		try {
			const stats = await fs.stat(candidate);
			if (!stats.isDirectory()) {
				continue;
			}
		} catch (error) {
			if ((error ?? {}).code === "ENOENT") {
				continue;
			}
			throw error;
		}

		const entries = await fs.readdir(candidate, { withFileTypes: true });
		const hasPackageJson = entries.some(
			(entry) => entry.isFile() && entry.name === "package.json",
		);
		if (hasPackageJson) {
			workspaceDirs.push(candidate);
			continue;
		}

		for (const entry of entries) {
			if (!entry.isDirectory()) {
				continue;
			}
			const pkgPath = path.join(candidate, entry.name, "package.json");
			try {
				const pkgStats = await fs.stat(pkgPath);
				if (pkgStats.isFile()) {
					workspaceDirs.push(path.join(candidate, entry.name));
				}
			} catch (error) {
				if ((error ?? {}).code !== "ENOENT") {
					throw error;
				}
			}
		}
	}
	return workspaceDirs;
};

const main = async () => {
	try {
		await fs.access(rootNodeModules);
	} catch (error) {
		if ((error ?? {}).code === "ENOENT") {
			console.warn(
				"[link-node-modules] Skipping workspace links; root node_modules missing",
			);
			return;
		}
		throw error;
	}

	const workspaceDirs = await findWorkspaceDirs();
	await Promise.all(workspaceDirs.map(ensureSymlink));
	console.log(
		`[link-node-modules] Linked node_modules into ${workspaceDirs.length} workspaces`,
	);
};

main().catch((error) => {
	console.error("[link-node-modules] Failed to create workspace links", error);
	process.exitCode = 1;
});
