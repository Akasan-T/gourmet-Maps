using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using NoodleMaps.Data;
using NoodleMaps.Models;

namespace NoodleMaps.Pages.Noodle
{
    public class IndexModel : PageModel
    {
        private readonly NoodleDbContext _context;

        public IndexModel(NoodleDbContext context)
        {
            _context = context;
        }

        // ページに表示するラーメンリスト
        public IList<NoodleEntry> NoodleEntry { get; set; } = default!;

        public async Task OnGetAsync()
        {
            if (_context.NoodleEntry != null)
            {
                // ランキングロジック
                NoodleEntry = await _context.NoodleEntry
                .OrderByDescending(e => e.OverallScore) //OverallScore(総合評価)
                .ToListAsync();
                // ランキングロジック
            }
        }
    }
}