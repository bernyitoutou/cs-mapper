"use node";

import { action } from "../_generated/server";
import { api } from "../_generated/api";
import ukSportsCategoriesData from "../lib/sphere/uk-sports-categories.json" with { type: "json" };

type SeedSportCategory = {
  name: string;
  url: string;
  sphereId: string;
  taxonomy: string;
  ddSports?: number[];
  articleSphereIds?: string[];
  articleIds?: string[];
};

type SeedSportCategoriesResult = {
  total: number;
  inserted: number;
  updated: number;
};

export const seedSportCategories = action({
  args: {},
  handler: async (ctx): Promise<SeedSportCategoriesResult> => {
    const categories = (ukSportsCategoriesData as SeedSportCategory[]).map((category) => ({
      ...category,
      ddSports: category.ddSports ?? undefined,
      articleSphereIds: category.articleSphereIds ?? undefined,
      articleIds: category.articleIds ?? undefined,
    }));

    const result: { inserted: number; updated: number } = await ctx.runMutation(
      api.services.sportCategories.bulkUpsertSportCategories,
      { categories }
    );

    await ctx.runMutation(api.services.logs.writelog, {
      type: "seed_sport_categories",
      status: "success",
      result: {
        total: categories.length,
        ...result,
      },
    });

    return {
      total: categories.length,
      ...result,
    };
  },
});