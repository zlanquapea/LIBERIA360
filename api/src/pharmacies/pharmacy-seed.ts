import { DataSource, IsNull } from "typeorm";
import { User } from "../users/entities/user.entity";
import { Pharmacy } from "./entities/pharmacy.entity";
import {
  FulfillmentMethod,
  PharmacyOrderStatus,
  PharmacyStatus,
} from "./entities/pharmacy.enums";
import {
  PharmacyInventory,
  PharmacyProduct,
  PharmacyProductCategory,
} from "./entities/product.entity";
import { PharmacyOrder } from "./entities/order.entity";

const CATEGORIES = [
  "Pain relief",
  "Cold and allergy",
  "First aid",
  "Vitamins",
  "Personal care",
];
const NAMES = [
  "Paracetamol tablets",
  "Ibuprofen tablets",
  "Antacid tablets",
  "Cough syrup",
  "Saline nasal spray",
  "Allergy relief tablets",
  "Adhesive bandages",
  "Antiseptic solution",
  "Sterile gauze",
  "Digital thermometer",
  "Vitamin C",
  "Daily multivitamin",
  "Oral rehydration salts",
  "Hand sanitizer",
  "Sunscreen lotion",
  "Moisturizing lotion",
  "Toothpaste",
  "Baby wipes",
  "Iron supplement",
  "Blood pressure monitor",
];
export async function seedPharmacyMarketplace(ds: DataSource) {
  const categoryRepo = ds.getRepository(PharmacyProductCategory),
    pharmacyRepo = ds.getRepository(Pharmacy),
    productRepo = ds.getRepository(PharmacyProduct),
    inventoryRepo = ds.getRepository(PharmacyInventory);
  await categoryRepo.upsert(
    CATEGORIES.map((name) => ({
      name,
      slug: name.toLowerCase().replaceAll(" ", "-"),
    })),
    ["slug"],
  );
  const categories = await categoryRepo.find();
  const pharmacies = [
    {
      name: "CarePoint Pharmacy",
      slug: "carepoint-pharmacy",
      address: "12 Broad Street",
      location: "Monrovia",
      telephone: "+231 77 000 1001",
      latitude: 6.3156,
      longitude: -10.8074,
      deliveryEnabled: true,
      pickupEnabled: true,
      deliveryFee: 150,
      status: PharmacyStatus.APPROVED,
    },
    {
      name: "Redemption Community Pharmacy",
      slug: "redemption-community-pharmacy",
      address: "Tubman Boulevard, Sinkor",
      location: "Monrovia",
      telephone: "+231 88 000 1002",
      latitude: 6.2902,
      longitude: -10.775,
      status: PharmacyStatus.APPROVED,
      deliveryEnabled: false,
      pickupEnabled: true,
      deliveryFee: 0,
    },
    {
      name: "Kakata Family Pharmacy",
      slug: "kakata-family-pharmacy",
      address: "Gbarnga Highway",
      location: "Kakata",
      telephone: "+231 77 000 1003",
      latitude: 6.531,
      longitude: -10.353,
      status: PharmacyStatus.APPROVED,
      deliveryEnabled: true,
      pickupEnabled: true,
      deliveryFee: 200,
    },
  ];
  await pharmacyRepo.upsert(pharmacies, ["slug"]);
  const saved = await pharmacyRepo.find({
    where: pharmacies.map((x) => ({ slug: x.slug })),
  });
  for (let i = 0; i < NAMES.length; i++) {
    const pharmacy = saved[i % saved.length],
      category = categories[i % categories.length];
    let product = await productRepo.findOneBy({
      pharmacyId: pharmacy.id,
      name: NAMES[i],
    });
    product = await productRepo.save(
      productRepo.create({
        ...product,
        pharmacyId: pharmacy.id,
        categoryId: category.id,
        name: NAMES[i],
        price: 75 + i * 18,
        prescriptionRequired: i === 2 || i === 18,
        isVisible: true,
      }),
    );
    await inventoryRepo.upsert(
      { productId: product.id, quantity: 8 + (i % 7) * 3 },
      ["productId"],
    );
  }
  const user = await ds
    .getRepository(User)
    .findOne({ where: { deletedAt: IsNull() } });
  if (user) {
    const orderRepo = ds.getRepository(PharmacyOrder),
      statuses = [
        PharmacyOrderStatus.PENDING,
        PharmacyOrderStatus.UNDER_REVIEW,
        PharmacyOrderStatus.PREPARING,
        PharmacyOrderStatus.COMPLETED,
      ];
    for (let i = 0; i < statuses.length; i++) {
      const exists = await orderRepo.findOneBy({
        customerUserId: user.id,
        pharmacyId: saved[i % saved.length].id,
        status: statuses[i],
      });
      if (!exists)
        await orderRepo.save(
          orderRepo.create({
            customerUserId: user.id,
            pharmacyId: saved[i % saved.length].id,
            status: statuses[i],
            fulfillmentMethod:
              i % 2 ? FulfillmentMethod.DELIVERY : FulfillmentMethod.PICKUP,
            deliveryAddress:
              i % 2 ? "Fictional development address, Monrovia" : null,
            productSubtotal: 350,
            deliveryFee: i % 2 ? 150 : 0,
            platformFee: 0,
            finalTotal: i % 2 ? 500 : 350,
          }),
        );
    }
  }
  console.log(
    `Seeded 3 pharmacies, 5 categories, ${NAMES.length} products, and development orders.`,
  );
}
