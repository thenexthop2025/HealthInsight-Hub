from reportlab.lib import colors


class ReportTheme:
    def __init__(self):
        self.primary = colors.HexColor("#65A30D")  # Lime-600
        self.accent = colors.HexColor("#0EA5A3")   # Blue-green accent
        self.blue = colors.HexColor("#3B82F6")     # Blue-500
        self.neutral_bg = colors.HexColor("#F5F7FA")
        self.surface = colors.white
        self.surface_muted = colors.HexColor("#EDF1F7")
        self.divider = colors.HexColor("#D7DDE5")
        self.text_primary = colors.HexColor("#1F2933")
        self.text_secondary = colors.HexColor("#4B5563")
        self.text_muted = colors.HexColor("#6B7280")
        self.warning = colors.HexColor("#F59E0B")
        self.danger = colors.HexColor("#EF4444")
        self.success = colors.HexColor("#16A34A")

        self.card_radius = 12
        self.section_spacing = 18
        self.card_padding = 14

        self.highlight_background = colors.HexColor("#ECFDF5")


THEME = ReportTheme()

