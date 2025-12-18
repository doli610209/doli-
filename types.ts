
export enum MealType {
  BREAKFAST = '早餐',
  LUNCH = '午餐',
  DINNER = '晚餐',
  SNACK = '點心'
}

export enum ActivityLevel {
  SEDENTARY = '1.2', // 久坐
  LIGHTLY_ACTIVE = '1.375', // 輕量運動 (每週 1-3 天)
  MODERATELY_ACTIVE = '1.55', // 中度運動 (每週 3-5 天)
  VERY_ACTIVE = '1.725', // 高度運動 (每週 6-7 天)
  EXTRA_ACTIVE = '1.9' // 專業運動 (每天運動或體力勞動)
}

export interface NutritionData {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

export interface FoodItem extends NutritionData {
  id: string;
  name: string;
  portion: string;
  imageUrl?: string;
}

export interface UserProfile {
  name: string;
  gender: 'male' | 'female';
  height: number;
  weight: number;
  age: number;
  avatarUrl: string;
  activityLevel: ActivityLevel;
}

export interface DailyLog {
  date: string;
  meals: Record<MealType, FoodItem[]>;
  goals: NutritionData;
}
