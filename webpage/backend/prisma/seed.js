import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const locations = ['Mumbai FC', 'Bangalore FC', 'Designer Studio'];
const products = [
  ['Ivory Silk Dog Kurta', 'ZNV-AAR-POC-DOGKURTA-IVORY-M', 'Mumbai FC', 14],
  ['Rose Zari Dog Lehenga', 'ZNV-AAR-POC-DOGLEHENGA-ROSE-S', 'Mumbai FC', 4],
  ['Aqua Linen Cat Harness', 'ZNV-IRA-PEV-CATHARNESS-AQUA-L', 'Bangalore FC', 26],
  ['Sand Quilted Pet Bed', 'ZNV-IRA-PEV-PETBED-SAND-M', 'Bangalore FC', 0],
  ['Noir Twin Bandana Set', 'ZNV-KAB-TWN-BANDANA-NOIR-F', 'Designer Studio', 0],
  ['Olive Twin Scarf Set', 'ZNV-KAB-TWN-MATCHSCARF-OLIVE-F', 'Designer Studio', 0]
];
try {
  for (const name of locations) await prisma.location.upsert({ where: { name }, update: {}, create: { name } });
  for (const [name, sku, locationName, quantity] of products) {
    const location = await prisma.location.findUniqueOrThrow({ where: { name: locationName } });
    const product = await prisma.product.upsert({ where: { sku }, update: { name, locationId: location.id }, create: { name, sku, locationId: location.id } });
    await prisma.inventory.upsert({ where: { productId: product.id }, update: { physical: quantity, available: quantity }, create: { productId: product.id, physical: quantity, available: quantity } });
  }
  console.log('Seeded ZENVE inventory catalog.');
} finally { await prisma.$disconnect(); }
