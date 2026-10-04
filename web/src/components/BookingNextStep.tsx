import { bookingNextStep } from "@/lib/booking-next-step";
export function BookingNextStep({
  status,
  hosting = false,
  date,
}: {
  status: string;
  hosting?: boolean;
  date?: string;
}) {
  return (
    <section className="rounded-xl bg-brand-50 p-4 text-sm dark:bg-slate-800">
      <h3 className="font-semibold">What happens next</h3>
      <p className="mt-1 leading-6">
        {bookingNextStep(
          status,
          hosting,
          !!date && date.slice(0, 10) < new Date().toISOString().slice(0, 10),
        )}
      </p>
    </section>
  );
}
