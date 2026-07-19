using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using GourmetMaps.Data;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace GourmetMaps.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class MembersController : ControllerBase
    {
        private const string GuestUserName = "guest-map";
        private readonly GourmetDbContext _context;

        public MembersController(GourmetDbContext context)
        {
            _context = context;
        }

        // GET: api/members
        [HttpGet]
        public async Task<ActionResult<IEnumerable<MemberDto>>> GetMembers()
        {
            var members = await _context.Users
                .AsNoTracking()
                .Where(user => user.DisplayName != null && user.DisplayName != "" && user.UserName != GuestUserName)
                .OrderBy(user => user.DisplayName)
                .Select(user => new MemberDto(user.Id, user.DisplayName!, user.AvatarUrl))
                .ToListAsync();

            return Ok(members);
        }

        public record MemberDto(string Id, string DisplayName, string? AvatarUrl);
    }
}
