import { connectToDatabase } from "@/lib/db/mongodb";
import { PricingComponentModel } from "@/models";
import { computeFinalPrice } from "@/lib/pricing/engine";
import { seedPricingComponents } from "@/lib/pricing/seed-data";

export async function seedPricingComponentsData() {
  await connectToDatabase();

  const operations = seedPricingComponents.map((item) => {
    const computed = computeFinalPrice(item);
    return {
      updateOne: {
        filter: { code: item.code },
        update: {
          $set: {
            ...item,
            marginPercentage: computed.marginPercentage,
            finalPrice: computed.finalPrice,
            isActive: true,
          },
        },
        upsert: true,
      },
    };
  });

  if (operations.length > 0) {
    await PricingComponentModel.bulkWrite(operations);
  }

  return { count: operations.length };
}
