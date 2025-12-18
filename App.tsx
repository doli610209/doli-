
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MealType, FoodItem, DailyLog, NutritionData, UserProfile, ActivityLevel } from './types';
import { analyzeFoodInput } from './geminiService';

const MEAL_CONFIG = [
  { type: MealType.BREAKFAST, icon: 'bakery_dining', color: 'orange', suggestion: '400-600 kcal' },
  { type: MealType.LUNCH, icon: 'restaurant', color: 'blue' },
  { type: MealType.DINNER, icon: 'dinner_dining', color: 'indigo' },
  { type: MealType.SNACK, icon: 'cookie', color: 'pink' },
];

const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  [ActivityLevel.SEDENTARY]: '久坐 (幾乎不運動)',
  [ActivityLevel.LIGHTLY_ACTIVE]: '輕量 (每週運動 1-3 天)',
  [ActivityLevel.MODERATELY_ACTIVE]: '中度 (每週運動 3-5 天)',
  [ActivityLevel.VERY_ACTIVE]: '高度 (每週運動 6-7 天)',
  [ActivityLevel.EXTRA_ACTIVE]: '專業 (每日運動或高體力勞動)',
};

const formatDate = (date: Date) => date.toISOString().split('T')[0];

const App: React.FC = () => {
  const [view, setView] = useState<'diary' | 'profile'>('diary');
  const [selectedDate, setSelectedDate] = useState<string>(formatDate(new Date()));
  
  // 使用者資料狀態
  const [user, setUser] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('nurture_user');
    return saved ? JSON.parse(saved) : {
      name: 'Alex',
      gender: 'male',
      height: 175,
      weight: 70,
      age: 28,
      avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=150&h=150',
      activityLevel: ActivityLevel.LIGHTLY_ACTIVE
    };
  });

  // 所有日期的紀錄
  const [allLogs, setAllLogs] = useState<Record<string, DailyLog>>(() => {
    const saved = localStorage.getItem('nurture_all_logs');
    return saved ? JSON.parse(saved) : {};
  });

  const [loadingMeal, setLoadingMeal] = useState<string | null>(null);

  // 計算當前日期的目標 (基於 TDEE)
  const currentGoals = useMemo(() => {
    const { height, weight, age, gender, activityLevel } = user;
    const bmr = gender === 'male' 
      ? (10 * weight) + (6.25 * height) - (5 * age) + 5
      : (10 * weight) + (6.25 * height) - (5 * age) - 161;
    const factor = parseFloat(activityLevel);
    const tdee = Math.round(bmr * factor);
    
    return {
      calories: tdee,
      protein: Math.round(weight * 1.8), 
      fat: Math.round(tdee * 0.25 / 9),
      carbs: Math.round((tdee - (weight * 1.8 * 4) - (tdee * 0.25)) / 4)
    };
  }, [user]);

  // 當前選中日期的日誌內容
  const currentLog = useMemo(() => {
    return allLogs[selectedDate] || {
      date: selectedDate,
      meals: {
        [MealType.BREAKFAST]: [],
        [MealType.LUNCH]: [],
        [MealType.DINNER]: [],
        [MealType.SNACK]: [],
      },
      goals: currentGoals
    };
  }, [allLogs, selectedDate, currentGoals]);

  // 當前日期的營養總計
  const totals = useMemo(() => {
    return (Object.values(currentLog.meals).flat() as FoodItem[]).reduce((acc, item) => ({
      calories: acc.calories + item.calories,
      protein: acc.protein + item.protein,
      fat: acc.fat + item.fat,
      carbs: acc.carbs + item.carbs,
    }), { calories: 0, protein: 0, fat: 0, carbs: 0 });
  }, [currentLog]);

  // 儲存資料到 localStorage
  useEffect(() => {
    localStorage.setItem('nurture_user', JSON.stringify(user));
    localStorage.setItem('nurture_all_logs', JSON.stringify(allLogs));
  }, [user, allLogs]);

  const handleAddItem = async (mealType: MealType, input: string | { base64: string, mimeType: string }) => {
    if (currentLog.meals[mealType].length >= 6) {
      alert('每餐最多只能紀錄 6 個項目喔！');
      return;
    }

    setLoadingMeal(mealType);
    try {
      const item = await analyzeFoodInput(input);
      if (typeof input !== 'string') {
        item.imageUrl = `data:${input.mimeType};base64,${input.base64}`;
      }
      
      const updatedMeals = {
        ...currentLog.meals,
        [mealType]: [...currentLog.meals[mealType], item]
      };

      setAllLogs(prev => ({
        ...prev,
        [selectedDate]: { ...currentLog, meals: updatedMeals, goals: currentGoals }
      }));
    } catch (e) {
      alert('Gemini 分析發生錯誤，請稍後再試');
    } finally {
      setLoadingMeal(null);
    }
  };

  const handleDeleteItem = (mealType: MealType, id: string) => {
    const updatedMeals = {
      ...currentLog.meals,
      [mealType]: currentLog.meals[mealType].filter(i => i.id !== id)
    };
    setAllLogs(prev => ({
      ...prev,
      [selectedDate]: { ...currentLog, meals: updatedMeals }
    }));
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedDate(e.target.value);
  };

  const goToToday = () => setSelectedDate(formatDate(new Date()));

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden max-w-md mx-auto shadow-2xl bg-[#f8fafc] dark:bg-[#0f172a]">
      {view === 'diary' ? (
        <>
          {/* 頂部 Header */}
          <header className="flex flex-col bg-white dark:bg-[#1e293b] pt-10 pb-6 px-6 rounded-b-[2.5rem] shadow-md z-20 sticky top-0 border-b border-gray-100 dark:border-gray-800">
            <div className="flex justify-between items-center mb-6">
              <div className="flex flex-col gap-1">
                {/* 日期選擇下拉/觸發器 */}
                <div className="flex items-center gap-2">
                  <div className="relative group">
                    <input 
                      type="date" 
                      className="absolute inset-0 opacity-0 cursor-pointer z-10" 
                      value={selectedDate}
                      onChange={handleDateChange}
                    />
                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full hover:bg-slate-200 transition-colors">
                      <span className="material-symbols-outlined text-sm text-primary">calendar_month</span>
                      <span className="text-xs font-black text-slate-700 dark:text-slate-200">
                        {new Date(selectedDate).toLocaleDateString('zh-TW', { month: 'long', day: 'numeric', weekday: 'short' })}
                      </span>
                      <span className="material-symbols-outlined text-xs text-slate-400">expand_more</span>
                    </div>
                  </div>
                  {selectedDate !== formatDate(new Date()) && (
                    <button onClick={goToToday} className="text-[10px] font-black text-primary bg-primary/10 px-2 py-1.5 rounded-full">
                      回到今天
                    </button>
                  )}
                </div>
                <h1 className="text-2xl font-black text-slate-800 dark:text-white mt-1">你好，{user.name}</h1>
              </div>
              <button onClick={() => setView('profile')} className="h-12 w-12 rounded-2xl overflow-hidden ring-4 ring-primary/10 shadow-lg">
                <img src={user.avatarUrl} alt="avatar" className="h-full w-full object-cover" />
              </button>
            </div>

            {/* 進度卡片 */}
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-[1.5rem] p-5 border border-slate-100 dark:border-slate-700/50">
              <div className="flex justify-between items-end mb-3">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-primary/60 uppercase tracking-tighter">每日攝取預算</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">{Math.round(totals.calories)}</span>
                    <span className="text-xs font-bold text-slate-400">/ {currentGoals.calories} kcal</span>
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-700 px-3 py-1.5 rounded-full shadow-sm">
                  <span className="text-xs font-black text-slate-600 dark:text-slate-300">
                    剩餘 <span className="text-primary">{Math.max(0, currentGoals.calories - Math.round(totals.calories))}</span>
                  </span>
                </div>
              </div>
              
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
                <div 
                  className="bg-primary h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(19,91,236,0.3)]" 
                  style={{ width: `${Math.min(100, (totals.calories / currentGoals.calories) * 100)}%` }}
                />
              </div>

              <div className="grid grid-cols-3 gap-3 mt-5">
                <MacroIndicator label="蛋白質" current={totals.protein} goal={currentGoals.protein} color="bg-emerald-500" />
                <MacroIndicator label="脂肪" current={totals.fat} goal={currentGoals.fat} color="bg-amber-500" />
                <MacroIndicator label="碳水" current={totals.carbs} goal={currentGoals.carbs} color="bg-rose-500" />
              </div>
            </div>

            {/* 快速日期滑動導航 (視覺同步) */}
            <div className="flex gap-2 mt-5 overflow-x-auto no-scrollbar">
              {[-3, -2, -1, 0, 1, 2, 3].map((offset) => {
                const d = new Date(); d.setDate(d.getDate() + offset);
                const dStr = formatDate(d);
                const isActive = dStr === selectedDate;
                return (
                  <button 
                    key={offset} 
                    onClick={() => setSelectedDate(dStr)}
                    className={`flex flex-col items-center justify-center min-w-[3.2rem] h-14 rounded-2xl transition-all duration-300 ${
                      isActive ? 'bg-primary text-white shadow-lg shadow-primary/30 transform scale-105' : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className={`text-[10px] uppercase font-bold ${isActive ? 'opacity-80' : ''}`}>
                      {d.toLocaleDateString('zh-TW', { weekday: 'short' })}
                    </span>
                    <span className="text-base font-black">{d.getDate()}</span>
                  </button>
                );
              })}
            </div>
          </header>

          <main className="flex-1 p-5 space-y-10 pb-20">
            {MEAL_CONFIG.map((meal) => (
              <MealSection 
                key={meal.type}
                meal={meal}
                items={currentLog.meals[meal.type]}
                onAddItem={handleAddItem}
                onDelete={handleDeleteItem}
                isLoading={loadingMeal === meal.type}
              />
            ))}
          </main>
        </>
      ) : (
        <ProfilePage user={user} onSave={(u) => { setUser(u); setView('diary'); }} onBack={() => setView('diary')} />
      )}
    </div>
  );
};

const MacroIndicator: React.FC<{ label: string, current: number, goal: number, color: string }> = ({ label, current, goal, color }) => (
  <div className="flex flex-col gap-1.5">
    <div className="flex justify-between items-center px-1">
      <span className="text-[10px] font-bold text-slate-500">{label}</span>
      <span className="text-[10px] font-black text-slate-800 dark:text-slate-200">{Math.round(current)}g</span>
    </div>
    <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
      <div className={`${color} h-full transition-all duration-500`} style={{ width: `${Math.min(100, (current / goal) * 100)}%` }} />
    </div>
  </div>
);

const MealSection: React.FC<any> = ({ meal, items, onAddItem, onDelete, isLoading }) => {
  const [text, setText] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  
  const handleTextAdd = () => { if(text.trim()) { onAddItem(meal.type, text); setText(''); } };
  
  const handleFileAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      onAddItem(meal.type, { base64, mimeType: file.type });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 flex items-center justify-center rounded-2xl text-white shadow-lg ${meal.color === 'orange' ? 'bg-orange-500' : meal.color === 'blue' ? 'bg-blue-500' : meal.color === 'indigo' ? 'bg-indigo-500' : 'bg-pink-500'}`}>
            <span className="material-symbols-outlined">{meal.icon}</span>
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-800 dark:text-white">{meal.type}</h3>
            <p className="text-[10px] font-bold text-slate-400">{items.length} / 6 個項目</p>
          </div>
        </div>
        {meal.suggestion && <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full text-slate-500">{meal.suggestion}</span>}
      </div>

      <div className="space-y-3">
        {items.map((item: FoodItem) => (
          <div key={item.id} className="bg-white dark:bg-[#1e293b] p-3 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex items-center gap-3">
            <div className="h-14 w-14 rounded-xl bg-slate-100 dark:bg-slate-800 bg-cover bg-center shrink-0 border border-slate-50 dark:border-slate-700 overflow-hidden">
              {item.imageUrl ? <img src={item.imageUrl} className="h-full w-full object-cover" /> : <div className="h-full w-full flex items-center justify-center"><span className="material-symbols-outlined text-slate-300">restaurant</span></div>}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate">{item.name}</h4>
              <p className="text-[10px] text-slate-400 mb-1">{item.portion}</p>
              <div className="flex gap-2">
                <MiniMacro val={item.protein} color="text-emerald-500" />
                <MiniMacro val={item.fat} color="text-amber-500" />
                <MiniMacro val={item.carbs} color="text-rose-500" />
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-black text-primary leading-tight">{Math.round(item.calories)}</p>
              <p className="text-[9px] font-bold text-slate-400 uppercase">kcal</p>
            </div>
            <button onClick={() => onDelete(meal.type, item.id)} className="text-slate-300 hover:text-rose-500 p-1">
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        ))}

        {items.length < 6 && (
          <div className="bg-white dark:bg-[#1e293b] p-4 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 transition-all hover:border-primary/30">
            <div className="flex gap-2">
              <input 
                className="flex-1 bg-slate-50 dark:bg-slate-800 border-0 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary/20 placeholder:text-slate-400 dark:text-white" 
                placeholder={`記錄下一份${meal.type}...`} 
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleTextAdd()}
                disabled={isLoading}
              />
              <button 
                onClick={() => fileRef.current?.click()} 
                disabled={isLoading}
                className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-400 flex items-center justify-center hover:bg-primary/10 hover:text-primary transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined">add_a_photo</span>
              </button>
              <input type="file" ref={fileRef} className="hidden" accept="image/*" onChange={handleFileAdd} />
            </div>
            {isLoading && (
              <div className="flex items-center justify-center gap-2 mt-3 py-1">
                <div className="h-2 w-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <div className="h-2 w-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="h-2 w-2 bg-primary rounded-full animate-bounce"></div>
                <span className="text-[10px] font-black text-primary uppercase ml-1">Gemini 分析中</span>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

const MiniMacro: React.FC<{ val: number, color: string }> = ({ val, color }) => (
  <span className={`text-[9px] font-black ${color} flex items-center gap-0.5`}>
    {Math.round(val)}<span className="opacity-50">g</span>
  </span>
);

const ProfilePage: React.FC<{ user: UserProfile, onSave: (u: UserProfile) => void, onBack: () => void }> = ({ user, onSave, onBack }) => {
  const [form, setForm] = useState(user);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const bmi = (form.weight / Math.pow(form.height / 100, 2)).toFixed(1);
  const getBmiStatus = (v: number) => {
    if (v < 18.5) return { label: '體重過輕', color: 'bg-blue-100 text-blue-600', dot: 'bg-blue-500' };
    if (v < 24) return { label: '正常體位', color: 'bg-emerald-100 text-emerald-600', dot: 'bg-emerald-500' };
    if (v < 27) return { label: '體重過重', color: 'bg-amber-100 text-amber-600', dot: 'bg-amber-500' };
    return { label: '肥胖', color: 'bg-rose-100 text-rose-600', dot: 'bg-rose-500' };
  };
  const status = getBmiStatus(parseFloat(bmi));

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setForm({ ...form, avatarUrl: reader.result as string });
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="flex flex-col bg-[#f8fafc] dark:bg-[#0f172a] min-h-screen">
      <div className="p-6 pt-12 space-y-8">
        <button onClick={onBack} className="flex items-center text-slate-400 font-bold hover:text-primary transition-colors">
          <span className="material-symbols-outlined mr-2">arrow_back_ios</span> 返回日誌
        </button>
        
        <div className="flex flex-col items-center">
          <div className="relative group cursor-pointer" onClick={() => avatarInputRef.current?.click()}>
            <div className="h-32 w-32 rounded-[2.5rem] overflow-hidden border-[6px] border-white dark:border-slate-800 shadow-2xl">
              <img src={form.avatarUrl} alt="avatar" className="h-full w-full object-cover" />
            </div>
            <div className="absolute -bottom-2 -right-2 bg-primary text-white p-2.5 rounded-2xl shadow-lg ring-4 ring-white dark:ring-slate-800 transition-transform active:scale-90">
              <span className="material-symbols-outlined text-xl">photo_camera</span>
            </div>
            <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={handleAvatarChange} />
          </div>
          <div className="mt-6 text-center space-y-2">
            <h2 className="text-3xl font-black text-slate-800 dark:text-white">個人設定</h2>
            <div className="flex items-center gap-3">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">當前 BMI</span>
                <span className="text-3xl font-black text-slate-800 dark:text-white leading-none">{bmi}</span>
              </div>
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-black text-xs ${status.color}`}>
                <div className={`h-2 w-2 rounded-full ${status.dot} animate-pulse`}></div>
                {status.label}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-[#1e293b] rounded-[2rem] p-6 shadow-sm border border-slate-100 dark:border-slate-800 space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">姓名</label>
            <input className="w-full bg-slate-50 dark:bg-slate-800 border-0 rounded-2xl px-5 py-3.5 text-sm font-bold dark:text-white" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">性別</label>
              <select className="w-full bg-slate-50 dark:bg-slate-800 border-0 rounded-2xl px-5 py-3.5 text-sm font-bold dark:text-white" value={form.gender} onChange={e => setForm({...form, gender: e.target.value as any})}>
                <option value="male">男性</option>
                <option value="female">女性</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">年齡</label>
              <input type="number" className="w-full bg-slate-50 dark:bg-slate-800 border-0 rounded-2xl px-5 py-3.5 text-sm font-bold dark:text-white" value={form.age} onChange={e => setForm({...form, age: parseInt(e.target.value) || 0})} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">身高 (cm)</label>
              <input type="number" className="w-full bg-slate-50 dark:bg-slate-800 border-0 rounded-2xl px-5 py-3.5 text-sm font-bold dark:text-white" value={form.height} onChange={e => setForm({...form, height: parseInt(e.target.value) || 0})} />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">體重 (kg)</label>
              <input type="number" className="w-full bg-slate-50 dark:bg-slate-800 border-0 rounded-2xl px-5 py-3.5 text-sm font-bold dark:text-white" value={form.weight} onChange={e => setForm({...form, weight: parseInt(e.target.value) || 0})} />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">運動型態 (TDEE 計算關鍵)</label>
            <select 
              className="w-full bg-slate-50 dark:bg-slate-800 border-0 rounded-2xl px-5 py-3.5 text-sm font-bold dark:text-white"
              value={form.activityLevel}
              onChange={e => setForm({...form, activityLevel: e.target.value as ActivityLevel})}
            >
              {Object.entries(ACTIVITY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        <button 
          onClick={() => onSave(form)}
          className="w-full bg-primary text-white font-black py-5 rounded-[2rem] shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all text-lg"
        >
          保存並更新計劃
        </button>
      </div>
    </div>
  );
};

export default App;
