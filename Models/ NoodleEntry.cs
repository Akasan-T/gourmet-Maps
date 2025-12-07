using System;
using System.ComponentModel.DataAnnotations;

namespace NoodleMaps.Models
{
    public class NoodleEntry
    {
        // データベースの主キー
        [key]
        public int id { get; set; }

        // 基本情報
        [Required]
        [Display(Name = "店名")]
        public string ShopName { get; set; }
        
        [DataType(DataType.Data)]
        [Display(Name = "訪問日")]
        public DataTime VisitData { get; set; } = DataTime.Now;

        [Display(Name = "ジャンル")]
        public string Genre { get; set; } //ラーメンのジャンル

        //要素別評価(1~5点)
        [Display(Name = "A: スープの旨み")]
        [Range(1, 5, ErrorMessage = "1から5の範囲で入力してください")]
        public int ScoreA_Soup { get; set; } //重み:3

        [Display(Name = "B: 麺の食感")]
        [Range(1, 5)]
        public int ScoreB_Noodle { get; set; } //重み:2

        [Display(Name = "C: 食材の満足度")]
        [Range(1, 5)]
        public int ScoreC_Topping { get; set; } //重み:1

        [Display(Name = "D: 雰囲気・接客")]
        [Range(1, 5)]
        public int ScoreD_Atmosphere { get; set; } //重み:1

        [Display(Name = "E: コストパフォーマンス")]
        [Range(1, 5)]
        public int ScoreE_CostPert { get; set; } //重み:2

        // 自動計算される総合評価点数（ランキングの基準）
        [DisplayFormat(DataFormatString = "{0:F2}")]
        [Display(Name = "総合評価" )]
        public double OverallScore { get; set; } //F2は小数点以下2桁表示

        // 地図情報
        public double? Latitude { get; set; } //経度 (?はNULL許容)
        public double? Latitude { get; set; } //緯度 (?はNULL許容)

        [Display(Name = "感想・メモ")]
        public string Notes { get; set; }
    }
}