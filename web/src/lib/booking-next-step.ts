export function bookingPeriod(status: string, endDate: string, today: string) {
  return ["cancelled", "declined", "completed"].includes(status) ||
    endDate.slice(0, 10) < today
    ? "history"
    : "upcoming";
}
export function bookingNextStep(status: string, hosting = false, past = false) {
  if (status === "cancelled")
    return "This booking was cancelled. Contact the provider about any outstanding payment or refund.";
  if (status === "declined")
    return "This request was declined. Choose another date or contact the provider for alternatives.";
  if (status === "completed")
    return "Your experience is complete. You can contact your guide with any follow-up questions.";
  if (past)
    return "The scheduled date has passed. Check with the provider if the booking status needs clarification.";
  if (status === "pending" || status === "requested")
    return hosting
      ? "Review the request and confirm or decline it. Include meeting instructions in your response."
      : "Awaiting the provider’s response. Your booking is not confirmed yet.";
  return hosting
    ? "Send the guest their meeting point, arrival time, and anything they should bring."
    : "Confirm your meeting point, arrival time, and what to bring with the provider before you travel.";
}
