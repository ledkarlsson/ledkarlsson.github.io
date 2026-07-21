import { describe, expect, it } from "vitest";
import {
  getCleanDrawioFileName,
  getGeneratedDrawioFileName,
  getPngFileName
} from "../assets/js/download.js";

describe("download file names", () => {
  it("keeps the compound drawio.xml extension", () => {
    expect(getCleanDrawioFileName("hamn.drawio.xml"))
      .toBe("hamn-utan-bas-info.drawio.xml");
    expect(getGeneratedDrawioFileName("hamn.drawio.xml"))
      .toBe("hamn-genererad.drawio.xml");
  });

  it("adds map variants before a regular extension", () => {
    expect(getCleanDrawioFileName("hamn.drawio"))
      .toBe("hamn-utan-bas-info.drawio");
    expect(getGeneratedDrawioFileName("hamn.drawio"))
      .toBe("hamn-genererad.drawio");
  });

  it("creates PNG names from both drawio extensions", () => {
    expect(getPngFileName("hamn-genererad.drawio.xml")).toBe("hamn-genererad.png");
    expect(getPngFileName("hamn-genererad.drawio")).toBe("hamn-genererad.png");
  });
});
