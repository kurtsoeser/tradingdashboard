/**
 * Explizite Dubletten → ein Anzeige-Basiswert (Trades + gespeicherte Meta).
 * Abgleich über {@link normalizeBasiswertKey} (wie bei Ticker-Vorschlägen).
 */
export type BasiswertMergeGroup = {
  readonly canonical: string;
  /** Weitere Schreibweisen, die auf canonical gemappt werden (ohne canonical selbst). */
  readonly aliases: readonly string[];
};

export const BASISWERT_MERGE_GROUPS: readonly BasiswertMergeGroup[] = [
  { canonical: "Dell Technologies", aliases: ["Dell"] },
  { canonical: "NVIDIA", aliases: ["Nvidia", "NVIDIA Corporation", "Nvidia Corporation", "NVIDIA Corp", "NVidia"] },
  { canonical: "Palantir Technologies", aliases: ["Palantir"] },
  {
    canonical: "Qualcomm",
    aliases: ["QUALCOMM", "Qualcomm Inc", "Qualcomm Inc.", "Qualcomm Incorporated"]
  },

  { canonical: "BAWAG Group", aliases: ["Bawag", "BAWAG", "Bawag Group"] },
  { canonical: "Intel", aliases: ["Intel Corporation"] },
  { canonical: "Broadcom", aliases: ["Broadcom Inc", "Broadcom Inc.", "Broadcom Incorporated"] },
  { canonical: "Micron Technology", aliases: ["Micron"] },
  { canonical: "Costco Wholesale", aliases: ["Costco"] },
  { canonical: "McDonald's", aliases: ["McDonalds", "McDonald´s", "Mcdonalds"] },

  { canonical: "Apple", aliases: ["Apple Inc", "Apple Inc."] },
  { canonical: "Microsoft", aliases: ["Microsoft Corporation"] },
  { canonical: "Alphabet", aliases: ["Google", "Alphabet Inc", "Alphabet Inc.", "Alphabet Inc Class A"] },
  { canonical: "Amazon", aliases: ["Amazon.com", "Amazon.com Inc", "Amazon Inc"] },
  { canonical: "Meta", aliases: ["Meta Platforms", "Meta Platforms Inc", "Facebook"] },
  { canonical: "Tesla", aliases: ["Tesla Inc", "Tesla Inc."] },
  { canonical: "AMD", aliases: ["Advanced Micro Devices", "Advanced Micro Devices Inc"] },
  { canonical: "Cisco Systems", aliases: ["Cisco"] },
  { canonical: "SAP", aliases: ["SAP SE"] },
  { canonical: "TSMC", aliases: ["Taiwan Semiconductor", "Taiwan Semiconductor Manufacturing", "TSM"] },
  { canonical: "Spotify", aliases: ["Spotify Technology", "Spotify Technology S.A.", "Spotify Technology SA"] },

  { canonical: "Netflix", aliases: ["Netflix Inc", "Netflix Inc."] },
  { canonical: "Oracle", aliases: ["Oracle Corporation"] },
  { canonical: "Adobe", aliases: ["Adobe Inc", "Adobe Inc.", "Adobe Systems"] },
  { canonical: "Salesforce", aliases: ["Salesforce Inc", "salesforce.com"] },
  { canonical: "PayPal", aliases: ["PayPal Holdings", "PayPal Holdings Inc"] },
  { canonical: "PepsiCo", aliases: ["Pepsi", "PepsiCo Inc"] },
  { canonical: "Starbucks", aliases: ["Starbucks Corporation"] },
  { canonical: "Walmart", aliases: ["Wal-Mart", "Wal-Mart Stores", "Walmart Inc"] },
  { canonical: "Visa", aliases: ["Visa Inc", "Visa Inc."] },
  { canonical: "Mastercard", aliases: ["Mastercard Inc", "Mastercard Incorporated"] },
  { canonical: "JPMorgan", aliases: ["JPMorgan Chase", "JPMorgan Chase & Co", "JP Morgan"] },
  { canonical: "Bank of America", aliases: ["BofA"] },
  { canonical: "Disney", aliases: ["Walt Disney", "The Walt Disney Company"] },
  { canonical: "Boeing", aliases: ["The Boeing Company"] },
  { canonical: "Coca-Cola", aliases: ["Coca Cola", "CocaCola", "The Coca-Cola Company"] },
  { canonical: "Exxon Mobil", aliases: ["Exxon", "ExxonMobil"] },
  { canonical: "Shell", aliases: ["Royal Dutch Shell", "Shell plc"] },
  { canonical: "Johnson & Johnson", aliases: ["J&J", "Johnson and Johnson"] },
  { canonical: "Berkshire Hathaway", aliases: ["Berkshire Hathaway B"] },
  { canonical: "Shopify", aliases: ["Shopify Inc", "Shopify Inc."] },
  { canonical: "Booking Holdings", aliases: ["Booking", "Priceline", "Booking.com"] },

  { canonical: "Siemens", aliases: ["Siemens AG"] },
  { canonical: "Allianz", aliases: ["Allianz SE"] },
  { canonical: "BASF", aliases: ["BASF SE"] },
  { canonical: "Bayer", aliases: ["Bayer AG"] },
  { canonical: "BMW", aliases: ["BMW AG"] },
  { canonical: "Mercedes-Benz", aliases: ["Mercedes Benz", "Daimler", "Daimler AG"] },
  { canonical: "Volkswagen", aliases: ["Volkswagen AG", "VW"] },
  { canonical: "Deutsche Bank", aliases: ["Deutsche Bank AG"] },
  { canonical: "Deutsche Telekom", aliases: ["Deutsche Telekom AG"] },
  { canonical: "Erste Group Bank", aliases: ["Erste Group", "Erste Bank"] },
  { canonical: "Rheinmetall", aliases: ["Rheinmetal"] }
];
