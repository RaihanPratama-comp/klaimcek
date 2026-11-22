// Built-in demo dataset: 8 claims, 6 receipts.
// Contains 1 exact duplicate, 1 amount mismatch, 1 missing receipt,
// 1 round-number outlier — so judges see every flag type in one click.
export const SAMPLE_CLAIMS_CSV = `employee,date,merchant,amount,category
Andi,2026-11-03,Indomaret,"Rp 87.500",Office supplies
Andi,2026-11-03,Indomaret,"Rp 87.500",Office supplies
Sari,2026-11-04,Grab,"Rp 42.000",Transport
Sari,2026-11-05,Tokopedia,"Rp 1.250.000",Equipment
Budi,2026-11-06,Warung Bu Tini,"Rp 35.000",Meals
Budi,2026-11-07,Shell,"Rp 300.000",Fuel
Dewi,2026-11-08,Blue Bird,"Rp 68.000",Transport
Dewi,2026-11-09,Adobe,"Rp 399.000",Software`;

export const SAMPLE_RECEIPTS = [
  `INDOMARET
Jl. Merdeka No. 10
03/11/2026 09:12
Kertas A4 1 rim      45.000
Pulpen 1 pak         22.500
Map plastik          20.000
TOTAL           Rp 87.500
Tunai           Rp100.000`,

  `GRAB
E-receipt perjalanan
04 Nov 2026
Sudirman - Blok M
TOTAL Rp 42.000`,

  `TOKOPEDIA
Invoice INV/2026/1105
05/11/2026
Keyboard mechanical
TOTAL Rp 1.050.000`,

  `WARUNG BU TINI
06/11/2026
Nasi ayam x2
TOTAL Rp 35.000`,

  `BLUE BIRD GROUP
08 Nov 2026
TOTAL Rp 68.000`,

  `ADOBE INC
09/11/2026
Creative Cloud subscription
TOTAL Rp 399.000`,
];
