import { fireEvent, render, screen } from "@testing-library/react";
import { DataSaverSetting } from "./DataSaverSetting";
it("stores the data preference and updates the accessible switch", () => {
  localStorage.clear();
  render(<DataSaverSetting />);
  const control = screen.getByRole("switch", { name: "Data Saver" });
  expect(control).toHaveAttribute("aria-checked", "false");
  fireEvent.click(control);
  expect(control).toHaveAttribute("aria-checked", "true");
  expect(localStorage.getItem("liberia360:data-saver")).toBe("on");
});
