export function computeFinalPrice(input: {
  basePrice: number;
  complexityMultiplier: number;
  marginPercentage: number;
}) {
  const protectedMargin = Math.max(20, input.marginPercentage);
  const computed =
    input.basePrice * input.complexityMultiplier * (1 + protectedMargin / 100);

  return {
    marginPercentage: protectedMargin,
    finalPrice: Number(computed.toFixed(2)),
  };
}
