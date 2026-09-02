from typing import Optional,Sequence

from typing_extensions import Annotated
from enum import  Enum
import typer
from types import SimpleNamespace

class InitDbOptionEnum(str, Enum):
    """
        Database initialization option
    """
    SQLITE = "sqlite"
    MYSQL = "mysql"
    POSTGRES = "postgres"


async def parse_cmd(argv: Optional[Sequence[str]] = None):
    """
        Parse command line arguments using Typer.
    """
    app = typer.Typer(add_completion = False)
    @app.callback(invoke_without_command = True)
    def main(
            init_db: Annotated[Optional[InitDbOptionEnum],typer.Option(
                "--init_db",
                help = "Initialize database table structure (sqlite | mysql | postgres)",
                rich_help_panel="Storage Configuration"
            )] = None
    ) -> SimpleNamespace:
        """
            MediaCrawler 命令行入口
        """
        init_db_value = "INIT DATABASE"
        print(" CMD ARG .......", app.__dict__)

        return  SimpleNamespace(
            init_db = init_db_value
        )
    command = typer.main.get_command(app)

    command.main(argv)