import { describe, expect, it } from "vitest";

import {
	getHudCaptureExcludedProcessIds,
	supportsHudCaptureProtection,
} from "../src/lib/hudCaptureProtection";

describe("HUD capture protection lifecycle", () => {
	it("uses window protection on Windows and macOS only", () => {
		expect(supportsHudCaptureProtection("win32")).toBe(true);
		expect(supportsHudCaptureProtection("darwin")).toBe(true);
		expect(supportsHudCaptureProtection("linux")).toBe(false);
	});

	it("only builds a macOS process exclusion when protection is enabled", () => {
		expect(getHudCaptureExcludedProcessIds("darwin", true, 734)).toEqual([734]);
		expect(getHudCaptureExcludedProcessIds("darwin", false, 734)).toEqual([]);
		expect(getHudCaptureExcludedProcessIds("win32", true, 734)).toEqual([]);
		expect(getHudCaptureExcludedProcessIds("linux", true, 734)).toEqual([]);
	});
});
