using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using NoodleMaps.Data; // DbContextの参照
using NoodleMaps.Models; //  NoodleEntryモデルの参照

namespace NoodleMaps.Pages.Noodle
{
    public class CreateModel : PageModel
    {
        private readonly NoodleDbContext _context;

        public CreateModel(NoodleDbContext context)
        {
            _context = context;
        }

        public IActionResult OnGet()
        {
            // ページ表示時の処理(特に操作なし)
            return Page();
        }

        [BindProperty]
        public NoodleEntry NoodleEntry { get; set; } = default!;

        // フォームが送信された時の処理
        public async Task<IActionResult> OnPostAsync()
        {
            // モデルの検証(入力チェック)
            if(!ModelState.IsValid || NoodleEntry == null)
            {
                return Page();
            }

        // ↓↓↓ 総合計算ロジック ↓↓↓

        // 合計重み: 9
        double totalWeight = 9;

        double weightedSum =
            (NoodleEntry.ScoreA_Soup * 3) +
            (NoodleEntry.ScoreB_Noodle * 2) +
            (NoodleEntry.ScoreC_Topping * 1) +
            (NoodleEntry.ScoreD_Atmosphere * 1)+
            (NoodleEntry.ScoreE_CostPerf * 2);

        NoodleEntry.OverallScore = weightedSum / totalWeight;

        // -----------------------------

        // データベースに保存
        _context.NoodleEntry.Add(NoodleEntry);
        await _context.SaveChangesAsync();

        //一覧ページへのリダイレクト
        return RedirectToPage("./Index");
        }
    }
}