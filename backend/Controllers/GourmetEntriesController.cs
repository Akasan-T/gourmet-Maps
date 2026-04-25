using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using GourmetMaps.Data;
using GourmetMaps.Models;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace GourmetMaps.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class GourmetEntriesController : ControllerBase
    {
        private readonly GourmetDbContext _context;
        public GourmetEntriesController(GourmetDbContext context)
        {
            _context = context;
        }

        // GET: api/gourmetentries
        [HttpGet]
        public async Task<ActionResult<IEnumerable<GourmetEntry>>> GetGourmetEntries()
        {
            return await _context.GourmetEntries.Include(e => e.User).ToListAsync();
        }
    }
}
