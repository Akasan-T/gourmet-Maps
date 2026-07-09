using System;
using System.ComponentModel.DataAnnotations;

namespace GourmetMaps.Models
{
    // 称号「初代タベマップ」保有者が発行するワンタイム招待コード。
    // 1回使うと使用済みになり、発行から一定時間で失効する。
    public class InviteCode
    {
        [Key]
        public int InviteCodeID { get; set; }

        [Required]
        public string Code { get; set; } = string.Empty;

        // 発行したユーザー (AspNetUsers.Id)
        [Required]
        public string CreatedByUserId { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; }

        // この時刻を過ぎると失効する
        public DateTime ExpiresAt { get; set; }

        // 使用された時刻 (未使用なら null)
        public DateTime? UsedAt { get; set; }

        // 使用して登録したユーザー (AspNetUsers.Id、未使用なら null)
        public string? UsedByUserId { get; set; }
    }
}
