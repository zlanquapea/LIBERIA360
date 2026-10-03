import { BanknotesIcon, ClockIcon, MapPinIcon, ShoppingBagIcon, TruckIcon } from '@heroicons/react/24/outline';
import { describeDeliveryFee } from '@/lib/food-ordering';
import type { MenuSettings } from '@/lib/types';

const chip =
  'inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200';

// At-a-glance delivery and payment indicators: whether the restaurant
// delivers and what it costs, pickup, delivery time and area, and which
// payments it takes. Used on the menu page and the profile menu preview.
export function OrderingInfo({ settings, showAreas = true }: { settings: MenuSettings; showAreas?: boolean }) {
  const cash =
    settings.deliveryEnabled && settings.pickupEnabled
      ? 'Cash'
      : settings.deliveryEnabled
        ? 'Cash on delivery'
        : 'Pay at pickup';
  return (
    <div className="flex flex-col gap-2">
      <ul aria-label="Delivery and payment" className="flex flex-wrap gap-2">
        {settings.deliveryEnabled ? (
          <li className={`${chip} border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200`}>
            <TruckIcon aria-hidden className="h-4 w-4" />
            {describeDeliveryFee(settings)}
          </li>
        ) : (
          <li className={`${chip} text-slate-500 dark:text-slate-400`}>
            <TruckIcon aria-hidden className="h-4 w-4" />
            No delivery
          </li>
        )}
        {settings.pickupEnabled && (
          <li className={chip}>
            <ShoppingBagIcon aria-hidden className="h-4 w-4" />
            Pickup
          </li>
        )}
        {settings.deliveryEnabled && settings.deliveryEstimate && (
          <li className={chip}>
            <ClockIcon aria-hidden className="h-4 w-4" />
            {settings.deliveryEstimate}
          </li>
        )}
        {settings.cashEnabled && (
          <li className={chip}>
            <BanknotesIcon aria-hidden className="h-4 w-4" />
            {cash}
          </li>
        )}
        {settings.mtnMomoNumber && (
          <li className={chip}>
            <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
            MTN MoMo
          </li>
        )}
        {settings.orangeMoneyNumber && (
          <li className={chip}>
            <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-orange-500" />
            Orange Money
          </li>
        )}
      </ul>
      {showAreas && settings.deliveryEnabled && settings.deliveryAreas && (
        <p className="flex items-start gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <MapPinIcon aria-hidden className="mt-px h-4 w-4 shrink-0" />
          Delivers to {settings.deliveryAreas}
        </p>
      )}
    </div>
  );
}
