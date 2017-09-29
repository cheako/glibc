#include <stddef.h>
#include <stdbool.h>
#include <regex.h>

bool reg_matches(const char *str, const char *pattern)
{
	    regex_t re;
	        int ret;

		    if (regcomp(&re, pattern, REG_EXTENDED) != 0)
			            return false;

		        ret = regexec(&re, str, (size_t) 0, NULL, 0);
			    regfree(&re);

			        if (ret == 0)
					        return true;

				    return false;
}

int main(void)
{
	   static const char *pattern = "/foo/[0-9]+$";

	      /* Going to return 1 always, since pattern wants the last part of the
		     * path to be an unsigned integer */
	      if (! reg_matches("/foo/abc", pattern))
		             return 1;

	         return 0;
}
