import { fireEvent, render, screen } from "@testing-library/react";
import { ConversationQuickReplies } from "./ConversationQuickReplies";
it("offers booking-specific draft text only after an explicit tap", () => {
  const select = jest.fn();
  render(<ConversationQuickReplies contextType="booking" onSelect={select} />);
  expect(select).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Where should we meet?" }));
  expect(select).toHaveBeenCalledWith("Where should we meet?");
});
it("keeps generic private chats free of booking suggestions", () => {
  const { container } = render(<ConversationQuickReplies contextType="direct" onSelect={jest.fn()} />);
  expect(container).toBeEmptyDOMElement();
});
