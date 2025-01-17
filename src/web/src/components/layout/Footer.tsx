import React, { memo } from 'react'; // v18.0.0
import { styled } from '@mui/material/styles'; // v5.14.0
import { Box, Typography, Container, Grid } from '@mui/material'; // v5.14.0
import { useTheme } from '@mui/material/styles'; // v5.14.0
import { palette, spacing, transitions } from '../../styles/theme.styles';

// Constants for footer links and social media
const FOOTER_LINKS = [
  { label: 'About', href: '/about', ariaLabel: 'Navigate to About page' },
  { label: 'Privacy', href: '/privacy', ariaLabel: 'View Privacy Policy' },
  { label: 'Terms', href: '/terms', ariaLabel: 'View Terms of Service' }
] as const;

const SOCIAL_LINKS = [
  { platform: 'Twitter', href: 'https://twitter.com/promptsportal', ariaLabel: 'Follow us on Twitter' },
  { platform: 'LinkedIn', href: 'https://linkedin.com/company/promptsportal', ariaLabel: 'Connect with us on LinkedIn' },
  { platform: 'GitHub', href: 'https://github.com/promptsportal', ariaLabel: 'View our GitHub repository' }
] as const;

// Styled components
const StyledFooter = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  padding: theme.spacing(4, 0),
  transition: theme.transitions.create(['background-color'], {
    duration: theme.transitions.duration.standard,
  }),
  borderTop: `1px solid ${theme.palette.divider}`,
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(3, 0),
  },
}));

const StyledLink = styled('a')(({ theme }) => ({
  color: theme.palette.text.secondary,
  textDecoration: 'none',
  transition: theme.transitions.create(['color'], {
    duration: theme.transitions.duration.shortest,
  }),
  '&:hover': {
    color: theme.palette.primary.main,
  },
  '&:focus': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: '2px',
  },
}));

const StyledSocialIcon = styled('a')(({ theme }) => ({
  color: theme.palette.text.secondary,
  marginLeft: theme.spacing(2),
  textDecoration: 'none',
  transition: theme.transitions.create(['color', 'transform'], {
    duration: theme.transitions.duration.shortest,
  }),
  '&:hover': {
    color: theme.palette.primary.main,
    transform: 'translateY(-2px)',
  },
  '&:focus': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: '2px',
  },
  [theme.breakpoints.down('sm')]: {
    marginLeft: theme.spacing(1.5),
  },
}));

const Footer: React.FC = memo(() => {
  const theme = useTheme();
  const currentYear = new Date().getFullYear();

  return (
    <StyledFooter component="footer" role="contentinfo">
      <Container maxWidth="lg">
        <Grid container spacing={3} alignItems="center" justifyContent="space-between">
          <Grid item xs={12} sm={6}>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ textAlign: { xs: 'center', sm: 'left' } }}
            >
              © {currentYear} Prompts Portal. All rights reserved.
            </Typography>
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: { xs: 'center', sm: 'flex-end' },
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: theme.spacing(2),
              }}
            >
              <nav aria-label="Footer navigation">
                <Box
                  sx={{
                    display: 'flex',
                    gap: theme.spacing(3),
                    [theme.breakpoints.down('sm')]: {
                      gap: theme.spacing(2),
                      justifyContent: 'center',
                      marginBottom: theme.spacing(2),
                    },
                  }}
                >
                  {FOOTER_LINKS.map(({ label, href, ariaLabel }) => (
                    <StyledLink
                      key={href}
                      href={href}
                      aria-label={ariaLabel}
                    >
                      <Typography variant="body2">
                        {label}
                      </Typography>
                    </StyledLink>
                  ))}
                </Box>
              </nav>

              <Box
                component="nav"
                aria-label="Social media links"
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  [theme.breakpoints.down('sm')]: {
                    justifyContent: 'center',
                  },
                }}
              >
                {SOCIAL_LINKS.map(({ platform, href, ariaLabel }) => (
                  <StyledSocialIcon
                    key={platform}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={ariaLabel}
                  >
                    <Typography variant="body2">
                      {platform}
                    </Typography>
                  </StyledSocialIcon>
                ))}
              </Box>
            </Box>
          </Grid>
        </Grid>
      </Container>
    </StyledFooter>
  );
});

Footer.displayName = 'Footer';

export default Footer;